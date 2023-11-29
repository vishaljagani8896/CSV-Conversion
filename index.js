const express = require("express");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const app = express();
const port = 3000;

let inputLinesCount = 0;
let outputLinesCount = 0;
let finalOutputfilePath = "";
let allOutuputFiles = [];
let originalfileName = "";
let downloadFileName = "";

app.use(express.static('./'));
app.use(fileUpload());

app.get("/", (req, res) => {
  deleteFilesInDirectory(path.join(__dirname, "outputs"));
  deleteFilesInDirectory(path.join(__dirname, "uploads"));
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/upload", async (req, res) => {
  try {
    const { files } = req;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    deleteFilesInDirectory(path.join(__dirname, "outputs"));
    deleteFilesInDirectory(path.join(__dirname, "uploads"));

    const inputFile = files.inputFile;
    const uploadDirectory = path.join(__dirname, "uploads");

    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory);
    }

    const inputFilePath = path.join(uploadDirectory, inputFile.name);

    await inputFile.mv(inputFilePath, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send(err);
      }

      allOutuputFiles = [];
      const newInExtension = "txt";
      const { dir, name } = path.parse(inputFilePath);
      originalfileName = name;

      const newInputFilePath = path.join(dir, `${name}.${newInExtension}`);

      fs.rename(inputFilePath, newInputFilePath, (err) => {
        if (err) {
          console.error(`Error renaming file: ${err.message}`);
          res.sendFile(path.join(__dirname, "error.html"));
        } else {
          console.log(`File renamed to: ${newInputFilePath}`);
          processFileAndCreateNewFile(newInputFilePath);
          const filePath = finalOutputfilePath;
          if (finalOutputfilePath != "") {
            res.sendFile(path.join(__dirname, "download.html"));
          } else {
            res.sendFile(path.join(__dirname, "error.html"));
          }
        }
      });
    });
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    res.status(500).send(`An error occurred: ${error.message}`);
  }
});

app.get("/download", (req, res) => {
  const fileStream = fs.createReadStream(downloadFileName);
  fileStream.on("error", (streamErr) => {
    console.error(`Error streaming file: ${streamErr.message}`);
    res.status(500).send("Internal Server Error");
  });

  // Set the appropriate headers for the response
  res.setHeader(
    "Content-disposition",
    `attachment; filename=${originalfileName}.csv`
  );
  res.setHeader("Content-type", "text/csv");

  // Pipe the file stream to the response
  fileStream.pipe(res);

  // Perform additional operations after download
  deleteFilesInDirectory(path.join(__dirname, "outputs"));
  deleteFilesInDirectory(path.join(__dirname, "uploads"));
  console.log("Download and cleanup successful.");
});

function processFileAndCreateNewFile(inputFilePath) {
  try {
    fs.readdir(path.join(__dirname, "uploads"), (err, files) => {
      if (err) {
        console.error("Error reading directory:", err);
        return;
      }
    });
    if (!fs.existsSync(inputFilePath)) {
      console.log(`The file ${inputFilePath} does not exist.`);
      return;
    }

    const outputDirectory = path.join(__dirname, "outputs");

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory);
    }

    const outputFilePath = path.join(
      __dirname,
      "outputs",
      `output_${Date.now()}.txt`
    );
    allOutuputFiles.push(outputFilePath);
    const inputFileContent = fs.readFileSync(inputFilePath, "utf-8");
    const lines = inputFileContent.split("\n");
    inputLinesCount = lines.length;
    let prevLine = lines[0].trim();
    const outputLines = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      if (!/^"([^"]*","[^"]*",")\d{2}-\d{2}-\d{2}"/.test(currentLine)) {
        prevLine += " " + currentLine;
      } else {
        if (prevLine) {
          outputLines.push(prevLine);
        }
        if (lines[i + 1]) {
          if (
            !/^"([^"]*","[^"]*",")\d{2}-\d{2}-\d{2}"/.test(lines[i + 1].trim())
          ) {
            prevLine = currentLine;
          } else {
            outputLines.push(currentLine);
            prevLine = "";
          }
        } else {
          outputLines.push(currentLine);
          prevLine = "";
        }
      }
    }

    if (prevLine) {
      outputLines.push(prevLine);
    }

    if (!fs.existsSync(outputFilePath)) {
      fs.writeFileSync(outputFilePath, "");
    }

    fs.writeFileSync(outputFilePath, outputLines.join("\n"));
    outputLinesCount = outputLines.length;

    if (inputLinesCount != outputLinesCount) {
      processFileAndCreateNewFile(outputFilePath);
    }else{

    finalOutputfilePath = allOutuputFiles[allOutuputFiles.length - 1];
    console.log("finallllll", finalOutputfilePath);
    console.log(`File ${outputFilePath} has been created successfully.`);
    const filePath = finalOutputfilePath;
    const newOpExtension = "csv";
    const { dir, name } = path.parse(filePath);

    const newOutputFilePath = path.join(dir, `${name}.${newOpExtension}`);

    fs.rename(filePath, newOutputFilePath, (err) => {
      if (err) {
        console.error(`Error renaming file: ${err.message}`);
        res.redirect("/");
      } else {
        console.log(`File renamed to: ${newOutputFilePath}`);
        printCSVFields(newOutputFilePath);
      }
    });
  }
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`The file ${inputFilePath} was not found.`);
    } else {
      console.log(`An error occurred: ${error.message}`);
    }
  }
}

function deleteFilesInDirectory(directoryPath) {
  // Read the contents of the directory
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err.message}`);
      return;
    }

    // Iterate through the files and delete each one
    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);

      // Delete the file
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `Error deleting file ${filePath}: ${unlinkErr.message}`
          );
        } else {
          console.log(`File deleted: ${filePath}`);
        }
      });
    });
  });
}

function printCSVFields(filePath) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }
    const cleanedData = data.replace(/",",/g, `',",`);
    const cleanedData1 = cleanedData.replace(/\r/g, "");
    fs.writeFile(filePath, cleanedData1, "utf8", (err) => {
      if (err) {
        console.error("Error writing to file:", err);
        return;
      }
      // const outputFile = "your_output_file.csv";
      const outputDirectory = path.join(__dirname, "outputs");

      if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory);
      }

      const outputFile = path.join(
        __dirname,
        "outputs",
        `${originalfileName}.csv`
      );
      downloadFileName = outputFile;
      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(outputFile);
      const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
        output: writeStream,
      });

      let lineNumber = 0;
      let fieldCount = 0;
      rl.on("line", (line) => {
        lineNumber++;
        const regex1 = /",([^"])/g;
        const modifiedLine1 = line.replace(regex1, "',$1");

        const regex2 = /", /g;
        const finalModifiedLine = modifiedLine1.replace(regex2, "', ");

        // Manually split the line into fields based on the CSV format
        const fields = finalModifiedLine.split('",');

        if (lineNumber == 2) {
          fieldCount = fields.length;
        }

        const newFields = fields.map((field, index) => {
          if (field.substring(0, 1) == '"') {
            field = field.slice(1);
          }

          if (index == 4) {
            if (field.indexOf('"') != -1) {
              field = field.replace('"', "");
            }
          }
          if (index != fields.length - 1) {
            field = field.replace(/"/g, "'");
          }
          if (lineNumber != 1) {
            field = `"${field}`;
          }
          return field;
        });
        const finalLine = newFields.join('",');
        writeStream.write(`${finalLine}\n`);
      });

      rl.on("close", () => {
        console.log(`Finished reading ${filePath}`);
        readStream.close();
        writeStream.close();
      });

      rl.on("error", (error) => {
        console.error(`Error reading ${filePath}: ${error.message}`);
      });
    });
  });
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
