const glob = require("glob");
const rimraf = require("rimraf");

const args = process.argv.slice(2);
console.log(args);

console.log("[REMOVING DIRECTORIES!!!]:\n");


for (let i = 0; i < args.length; ++i) {
  glob(args[i], {}, function (er, files) {
    // Log an error
    if (er) {
      console.log(er);
    }

    for (let i in files) {
      console.log("Attempting Removal of ... " + files[i]);
      // Attempt to remove file with rimraf "https://www.npmjs.com/package/rimraf"
      rimraf(files[i], function (e) {
        if (e) {
          console.log(e);
        } else {
          console.log()
        }
      });
    }
  })
}
