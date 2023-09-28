const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');

/**
 * @param closure
 * @param successPredicate
 * @param retryIntervalSeconds
 * @param maxRetries
 */
async function frontendInputBuild (cli, inputPath) {
    return new Promise((resolve, reject) => {
        // analyse that dist/ folder and package.json folder are present on this directory
        const distInputPath = path.join(inputPath, 'dist');
        const pkgJsonInputPath = path.join(inputPath, 'package.json');
        let valid = true;
        if (!fs.existsSync(distInputPath)) {
            valid = false;
            cli.log(`Error: There is no 'dist' folder in ${inputPath}. Please, run 'npm run build' in the project folder before running this command.`)
        }
        if (!fs.existsSync(pkgJsonInputPath)) {
            valid = false;
            cli.log(`Error: There is no 'package.json' file in ${inputPath}. Ensure you're sending the right folder which contains your frontend-pipeline project.`)
        }
        if (!valid) {
            return reject(new Error('There were some validation errors when processing zip file for the frontend-pipeline input path'));
        }

        fs.mkdtemp(path.join(os.tmpdir(), 'aio-rde-'), (err, folder) => {
            if (err) {
                return reject(err);
            }
            const targetZipPath = path.join(folder, 'frontend-pipeline.zip');
            let output = fs.createWriteStream(targetZipPath);
            let archive = archiver('zip');
            let zipSizeBytes;
            output.on('close', function () {
                zipSizeBytes = archive.pointer();
                cli.log(`Zipped file of ${zipSizeBytes} total bytes`);
                return resolve({
                    inputPath: fs.realpathSync(targetZipPath),
                    inputPathSize: zipSizeBytes,
                });
            });
            archive.on('error', function(err){
                return reject(err);
            });
            archive.pipe(output);
            // append files from a sub-directory
            archive.directory(distInputPath, 'dist');
            archive.file(pkgJsonInputPath, { name: 'package.json' });
            archive.finalize(); 
        });
    })
}
  
module.exports = {
    frontendInputBuild,
};