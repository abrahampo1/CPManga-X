const drivelist = require("drivelist");
async function search_kindle() {
  let drives = await drivelist.list();
  let kindle_path = false;
  drives.forEach((drive) => {
    if (drive.description == "Kindle Internal Storage USB Device") {
      console.log("Kindle on " + drive.mountpoints[0].path);
      kindle_path = drive.mountpoints[0].path;
    }
  });
  if (kindle_path) {
    return kindle_path;
  } else {
    return false;
  }
}

async function detect_kindle() {
  let k = await search_kindle();
  localStorage.setItem("kindlepath", k);
  if (!k) {
    $("#kindle").removeClass("success");
    $("#kindle p").text("Kindle not detected");
    $("#kindle").fadeIn();
  } else {
    $("#kindle p").text("Kindle on " + k);
    $("#kindle").addClass("success");
    setTimeout(() => {
      $("#kindle").fadeOut();
    }, 5000);
  }
}
var autokindle = localStorage.getItem("detect-kindle");
if (autokindle == "true") {
  detect_kindle();
}
setInterval(() => {
  var autokindle = localStorage.getItem("detect-kindle");
  if (autokindle == "true") {
    detect_kindle();
  }
}, 10000);

function read_kindle() {
  let kindle_path = localStorage.getItem("kindlepath");
  fs.readdir(
    path.join(kindle_path, "/documents/cpmanga/"),
    { withFileTypes: true },
    (error, files) => {
      const directoriesInDIrectory = files
        .filter((item) => item.isDirectory())
        .map((item) => item.name);

      directoriesInDIrectory.forEach(async (id) => {
        let manga = await MFA.Manga.get(id);
        console.log(manga.localizedTitle.localString);
      });
    }
  );
}
