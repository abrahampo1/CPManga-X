const MFA = require("mangadex-full-api");
const fastFolderSizeSync = require("fast-folder-size/sync");
const { fstat } = require("fs");
var path = require("path");
const mfa_user = localStorage.getItem("mangadex-user");
const mfa_pass = localStorage.getItem("mangadex-password");

if (!mfa_pass || !mfa_user) {
  $(".library").load("pages/login.html");
} else {
  MFA.login(mfa_user, mfa_pass, ".md_cache")
    .then(() => {
      $(".library").load("pages/home.html");
    })
    .catch((e) => {
      localStorage.removeItem("mangadex-user");
      localStorage.removeItem("mangadex-password");
      location.reload();
    });
}

function test_login() {
  let user = $("#muser").val();
  let pass = $("#mpass").val();
  MFA.login(user, pass, ".md_cache")
    .then(() => {
      localStorage.setItem("mangadex-user", user);
      localStorage.setItem("mangadex-password", pass);
      location.reload();
    })
    .catch((e) => {
      alert(e);
    });
}

function load_carrousel() {
  let languaje = JSON.parse(localStorage.getItem("mangadex-languaje")) || [
    "en",
  ];
  MFA.Manga.search({ limit: 3, availableTranslatedLanguage: languaje }).then(
    (r) => {
      $(".carrousel").html("");
      r.forEach(async (manga) => {
        let covers = await manga.getCovers();
        let author = await MFA.Author.get(manga.authors[0].id);
        var randomColor1 = Math.floor(Math.random() * 16777215).toString(16);
        var randomColor2 = Math.floor(Math.random() * 16777215).toString(16);
        $(".carrousel").append(
          `
          <div class="gcard" onclick="load_manga('${manga.id}')" style="background: linear-gradient(312deg, #${randomColor1} 0%, #${randomColor2} 100%);">
            <div class="flex">
              <img
                src="${covers[0]["image256"]}"
                alt=""
              />
              <div class="data">
                <h1>${manga.localizedTitle.localString}</h1>
                <p>by ${author.name}</p>
              </div>
            </div>
          </div>
          `
        );
        let scrollElement = document.querySelector(".carrousel");
        scrollElement.scrollLeft =
          (scrollElement.scrollWidth - scrollElement.clientWidth) / 2;
      });
    }
  );
}

function search_manga(query) {
  $("#loading").show();
  $(".library").load("pages/search.html", () => {
    $("#search_query").text(query);
    let languaje = JSON.parse(localStorage.getItem("mangadex-languaje")) || [
      "en",
    ];
    MFA.Manga.search({
      title: query,
      limit: 10,
      availableTranslatedLanguage: languaje,
    }).then((mangas) => {
      $("#search_results").html("");
      mangas.forEach(async (manga) => {
        let covers = await manga.getCovers();
        let author = await MFA.Author.get(manga.authors[0].id);
        $("#search_results").append(`
        <div class="bcard" onclick="load_manga('${manga.id}')">
    <img src="${covers[0].image256}" alt="" />
    <div class="bdata">
      <h4>${manga.localizedTitle.localString}</h4>
      <p>${author.name}</p>
    </div>
  </div>
        `);
      });
      $("#loading").fadeOut();
    });
  });
}
let curr_manga;

async function load_manga(id) {
  $("#loading").show();
  $(".library").load("pages/manga.html", async () => {
    $("#fav").on("click", () => {
      let liked = JSON.parse(localStorage.getItem("liked")) || {};

      if (liked[curr_manga.id]) {
        delete liked[curr_manga.id];
        localStorage.setItem("liked", JSON.stringify(liked));
        $("#fav").attr("icon", "ic:outline-star-border");
      } else {
        liked[curr_manga.id] = curr_manga;
        localStorage.setItem("liked", JSON.stringify(liked));
        $("#fav").attr("icon", "ic:outline-star");
      }
    });
    let manga = await MFA.Manga.get(id, true);
    let cover = await manga.getCovers();
    curr_manga = manga;
    let languaje = JSON.parse(localStorage.getItem("mangadex-languaje")) || [
      "en",
    ];

    let chapters = await manga.getFeed(
      {
        order: { chapter: "asc" },
        translatedLanguage: languaje,
        includeExternalUrl: 0,
        limit: 99999999,
      },
      true
    );

    $("#g_download").off("click");
    $("#g_download").on("click", () => {
      group_download(manga.id);
    });

    let liked = JSON.parse(localStorage.getItem("liked")) || {};
    if (liked[curr_manga.id]) {
      $("#fav iconify-icon").attr("icon", "ic:outline-star");
    } else {
      $("#fav iconify-icon").attr("icon", "ic:outline-star-border");
    }
    curr_manga.cover = cover[0].image512;
    $(".mangaInfo img").attr("src", cover[0].image512);
    $(".chapters").html("");

    $(".mangaInfo h3").text(manga.localizedTitle.localString);
    let author = await manga.authors[0].resolve();
    $(".mangaInfo p").text(author.name);
    let manga_resume = {};
    for (let index = 0; index < chapters.length; index++) {
      const chapter = chapters[index];
      let cl = "";
      let group = "";
      if (chapter.groups[0]) {
        group = await chapter.groups[0].resolve();
        chapter.groupname = group.name;
      }

      if (!manga_resume[chapter.chapter]) {
        manga_resume[chapter.chapter] = [];
      }

      manga_resume[chapter.chapter].push(chapter);
    }

    Object.entries(manga_resume).forEach(async ([key, value]) => {
      let chapter_holder = $(
        `<div class="chapterHolder"><h4>Chapter ${key}</h4></div>`
      );

      for (let index = 0; index < value.length; index++) {
        const chapter = value[index];
        let downloaded = JSON.parse(localStorage.getItem("downloaded")) || {};
        let cl = "";
        let size = "";
        let kindle_icon = "";
        let download_icon = "subway:cloud-download";
        if (downloaded[manga.id] && downloaded[manga.id][chapter.id]) {
          let home = require("os").homedir();
          let manga_path =
            home + "/Documents/cpmanga/manga/" + manga.id + "/" + chapter.id;
          if (fs.existsSync(manga_path)) {
            cl = "downloaded";
            download_icon = "subway:cloud-reload";
            size = fastFolderSizeSync(manga_path);
            size = `<div class="size">${(size / 1000 / 1000).toFixed(
              2
            )} MB</div>`;
            manga_path = manga_path.replace(/\\/g, "/");
            kindle_icon = `
            
            <iconify-icon onclick="generate_mobi(['${manga_path}'], '${manga.localizedTitle.localString}', '${chapter.chapter}', this)" icon="mdi:file-send-outline"></iconify-icon>
            
            `;
          }
        }
        $(chapter_holder).append(`
        <div class="chapter ${cl}">
           <div class="progress"></div>
         <div class="flex">
           <div class="num">${chapter.chapter}</div>
           <div class="title">${chapter.title} <span class="secondary">${chapter.groupname}</span></div>
         </div>
         <div class="flex">
         ${size}
         <iconify-icon onclick="group_add('${manga.id}', '${chapter.id}', ${chapter.chapter}, this)" class="gicon"
           icon="material-symbols:check-box-outline-blank"
         ></iconify-icon>
         <iconify-icon id="download" onclick="download_chapter('${manga.id}', '${chapter.id}', this.parentNode.parentNode)"
         icon="${download_icon}"
       ></iconify-icon>
       ${kindle_icon}

         </div>
      </div>
        `);
      }

      $(".chapters").append(chapter_holder);
    });
    chapters.forEach(async (chapter) => {
      //   let icon = `
      //   <iconify-icon onclick="group_add('${manga.id}', '${chapter.id}', ${chapter.chapter}, this)" class="gicon"
      //     icon="material-symbols:check-box-outline-blank"
      //   ></iconify-icon>
      //   <iconify-icon id="download" onclick="download_chapter('${manga.id}', '${chapter.id}', this.parentNode.parentNode)"
      //   icon="material-symbols:download-sharp"
      // ></iconify-icon>`;
      //   let downloaded = JSON.parse(localStorage.getItem("downloaded")) || {};
      //   if (downloaded[manga.id] && downloaded[manga.id][chapter.id]) {
      //     icon += `
      //     <iconify-icon class="download_complete"
      //     icon="ic:outline-download-done"
      //   ></iconify-icon>`;
      //     cl = "downloaded";
      //   }
      //   $(".chapters").append(`
      //     <div class="chapter ${cl}">
      //     <div class="progress"></div>
      //   <div class="flex">
      //     <div class="num">${chapter.chapter}</div>
      //     <div class="title">${chapter.title} <span class="secondary">${group}</span></div>
      //   </div>
      //   <div class="flex">
      //   ${icon}
      //   </div>
      // </div>
      //     `);
    });
    $("#loading").fadeOut();
  });
}
