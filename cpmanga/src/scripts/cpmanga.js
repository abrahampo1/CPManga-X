const fs = require("fs");
const exec = require("child_process");
var path = require("path");

const { ipcRenderer } = require("electron");

let download_query = {};

async function download_chapter(manga, chapter, holder) {
  //Verify that the chapter is on query
  if (download_query[chapter]) {
    return false;
  } else {
    download_query[chapter] = true;
  }

  //Manga variables
  let mangaid;
  let chapterid;
  let chapternumber;

  //Get HTML elements to modify
  holder.classList.remove("downloaded");
  let progress = holder.querySelector(".progress");
  let icon = holder.querySelector("#download");
  let gicon = holder.querySelector(".gicon");
  $(gicon).hide();
  let dicon = holder.querySelector(".download_complete");
  $(dicon).hide();
  $(icon).attr("icon", "line-md:downloading-loop");

  //Get Mangadex Info
  manga = await MFA.Manga.get(manga);
  chapter = await MFA.Chapter.get(chapter);

  //Set custom variables

  mangaid = manga.id;
  chapterid = chapter.id;
  chapternumber = chapter.chapter;

  //Set manga Path to be downloaded
  let home = require("os").homedir();
  let manga_path =
    home + "/Documents/cpmanga/manga/" + mangaid + "/" + chapterid;

  //Set te manga title (used to give the name on kindle)
  folder(manga_path);

  //Iterate and download the chapter pages
  let pages = await chapter.getReadablePages();
  for (let index = 0; index < pages.length; index++) {
    let page_name = index;
    if (index < 10) {
      page_name = "0" + index;
    }
    const file_name = manga_path + "/" + page_name + ".png";

    //Check if image already exist, if not, download it (this will make the downloads really faster with cached images)
    if (!fs.existsSync(file_name)) {
      await downloadImage(pages[index], file_name, chapter.id);
    }

    //Set progress bar progress
    let percent = ((index + 1) / pages.length) * 100;
    progress.style.width = percent + "%";
  }

  //Set manga downloaded on localstorage
  let downloaded = JSON.parse(localStorage.getItem("downloaded")) || {};
  if (downloaded[manga.id]) {
    downloaded[manga.id][chapter.id] = true;
  } else {
    downloaded[manga.id] = {};
    downloaded[manga.id][chapter.id] = true;
  }
  localStorage.setItem("downloaded", JSON.stringify(downloaded));

  //just finish
  holder.classList.add("downloaded");
  $(icon).attr("icon", "ic:outline-download-done");
  $(progress).fadeOut("fast");
  $(gicon).show();
  $(dicon).show();
  return manga_path;
}

async function pass_to_kindle(mobifile, mangaid, default_path = "") {
  let kindle_path = await search_kindle();
  if (!kindle_path) {
    alert("INSERT THE AMAZON KINDLE IN ORDER TO SEND THE MANGA");
  }

  fs.copyFileSync(
    mobifile,
    path.join(kindle_path, default_path + "/" + mangaid)
  );
  return true;
}

function downloadImage(url, filepath, chapterid) {
  return new Promise((resolve, reject) => {
    ipcRenderer.once(chapterid, (path) => {
      resolve(path);
    });
    ipcRenderer.send("DownloadImage", {
      url: url,
      filepath: filepath,
      returnId: chapterid,
    });
  });
}

async function generate_mobi(folders = [], title = "", chapters = "", holder) {
  return new Promise((resolve, reject) => {
    //Get HTML elements
    let progress = holder.querySelector(".progress");
    holder.classList.remove("downloaded");
    progress.style.width = "0%";
    $(progress).show();

    $(holder).attr("icon", "line-md:uploading-loop");

    //Temporary folder
    let home = require("os").homedir();
    const tempmangas = home + "/Documents/cpmanga/manga/tempmangas";

    //Check if temporary folder exists
    if (fs.existsSync(tempmangas)) {
      //Delete temporary folder content
      console.log("Deleting Temporary Files");
      fs.rmdirSync(tempmangas, {
        recursive: true,
        force: true,
      });
      console.log("Deleted!");
    }

    progress.style.width = "10%";

    //Recreate the folder
    console.log("Recreating temporary folder...");
    fs.mkdirSync(tempmangas);
    console.log("Recreated on " + path.join(__dirname, "tempmangas"));

    //Set the currentpage var to 0
    let current_page = 0;

    //Iterate through manga images on each chapter
    for (let index = 0; index < folders.length; index++) {
      const current_folder = folders[index];
      let contents = fs.readdirSync(current_folder);
      console.log("Copying contents to temporary folder");
      let percent = (index + 1) / folders.length;
      for (let p = 0; p < contents.length; p++) {
        let chapter_percent = percent * contents.length + 10;
        progress.style.width = chapter_percent + "%";

        const page = contents[p];
        let page_name = current_page;
        if (current_page < 10) {
          page_name = "0" + current_page;
        }
        fs.copyFileSync(
          path.join(current_folder, page),
          path.join(tempmangas, page_name + ".png")
        );
        current_page++;
      }
    }
    progress.style.width = "50%";

    //Send command to KCC
    console.log("Executing KCC...");
    let kcc = exec.exec(
      '"./mobi/kcc-c2e" -p KPW "' +
        tempmangas +
        '" -t "' +
        title +
        ` ${chapters}"`
    );

    kcc.stdout.on("data", function () {
      console.log("KCC Done!");
      progress.style.width = "70%";
    });

    kcc.on("exit", function () {
      //If the MOBI exists, just give it
      if (fs.existsSync(tempmangas + ".mobi")) {
        progress.style.width = "90%";
        console.log("Mobi on:", tempmangas + ".mobi");
        progress.style.width = "100%";
        $(progress).hide();
        $(holder).attr("icon", "mdi:file-send-outline");
        holder.classList.add("downloaded");
        resolve(tempmangas + ".mobi");
      } else {
        console.error("Couldn't find the generated mobi");
        $(holder).attr("icon", "material-symbols:error-rounded");
        reject(false);
      }
    });
  });
}

let group_query = {};

function group_add(mangaid, chapterid, chapternum, element) {
  if (group_query[mangaid]) {
    if (group_query[mangaid][chapterid]) {
      delete group_query[mangaid][chapterid];
      $(element).attr("icon", "material-symbols:check-box-outline-blank");
      return false;
    }
    $(element).attr("icon", "material-symbols:check-box");
    group_query[mangaid][chapterid] = {
      chapter: chapternum,
      element: element.parentNode.parentNode,
      check: element,
    };
  } else {
    group_query[mangaid] = [];
    $(element).attr("icon", "material-symbols:check-box");
    group_query[mangaid][chapterid] = {
      chapter: chapternum,
      element: element.parentNode.parentNode,
      check: element,
    };
  }

  if (Object.keys(group_query).length > 0) {
    $("#g_download").prop("disabled", false);
  } else {
    $("#g_download").prop("disabled", true);
  }
}

async function group_download(mangaid, send_to_kindle = true) {
  let group_array = group_query[mangaid];
  let chapter_numbers = Object.values(group_array);
  group_array = Object.keys(group_array);

  chapter_numbers.forEach((element) => {
    $(element.check).hide();
    let icon = element.element.querySelector("#download");
    $(icon).attr("icon", "material-symbols:downloading-rounded");
  });
  if (group_array.length > 0) {
    $("#g_download").prop("disabled", true);
    let donwloading_array = [];
    let downloaded = 0;
    for (let index = 0; index < group_array.length; index++) {
      let home = require("os").homedir();

      const chapter = group_array[index];
      const element = chapter_numbers[index].element;
      let manga_path =
        home + "/Documents/cpmanga/manga/" + mangaid + "/" + chapter;
      donwloading_array.push(manga_path);
      download_chapter(mangaid, chapter, element).then(async () => {
        downloaded++;
        if (send_to_kindle && downloaded == group_array.length) {
          //Search if kindle is connected
          let kindle_path = await search_kindle();

          //To-do download without kindle, meanwhile give an alert message
          if (!kindle_path) {
            alert("Please connect the kindle to auto pass the manga");
            return false;
          }
          $(icon).attr("icon", "line-md:uploading-loop");
          let manga = await MFA.Manga.get(mangaid);
          let mobi = await generate_mobi(
            donwloading_array,
            manga.localizedTitle.localString,
            chapter_numbers[0].chapter +
              "-" +
              chapter_numbers[chapter_numbers.length - 1].chapter,
            chapter_numbers[chapter_numbers.length - 1].element
          );
          await pass_to_kindle(mobi, mangaid);
          $(icon).attr("icon", "line-md:clipboard-check");
        }
      });
    }
    $(".gicon").attr("icon", "material-symbols:check-box-outline-blank");
    group_query = {};
  }
}

function folder(folderName) {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }
}

function test_download() {
  MFA.Manga.search({
    limit: 1,
    availableTranslatedLanguage: ["es"],
    includeExternalUrl: false,
  }).then(async (r) => {
    let manga = r[0];
    let chap = await manga.getFeed({
      limit: 1,
      translatedLanguage: ["es"],
    });
    console.log(manga);
    console.log(chap[0]);
    download_chapter(manga, chap[0], "");
  });
}
