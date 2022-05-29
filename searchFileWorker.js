
const { Client, logger } = require("camunda-external-task-client-js");
const { Variables } = require("camunda-external-task-client-js");
const IPFS = require('ipfs-core');
const toBuffer = require('it-to-buffer');

const config = { baseUrl: "http://localhost:8082/engine-rest", use: logger };

const client = new Client(config);
const ipfs = IPFS.create();
const ROOT_DIRECTORY = '/onlab';

client.subscribe("search-by-name", async function({ task, taskService }) {

  const name = task.variables.get("name");

  const firstIterator = (await ipfs).files.ls(ROOT_DIRECTORY);
  var resultFiles = new Map();      // contains objects with the file, cid, and the directory's path

  for await (const directory of firstIterator) {
    for await (const file of (await ipfs).files.ls(ROOT_DIRECTORY + '/' + directory.name)) {
        if (file.name.endsWith('.json')) {              // search in json files

            const pathName = ROOT_DIRECTORY + '/' + directory.name + '/' + file.name;         
            const jsonFile = await readIpfsFile(pathName);      
            if (jsonFile.name == name) {
                resultFiles.set(jsonFile.filePath, jsonFile.fileCid);
            }

        }
        //console.log(ROOT_DIRECTORY + '/' + directory.name + '/' + file.name)
    }
  }

  const processVariables = new Variables();
  if (resultFiles.size !== 0) {
      for (const [path, cid] of resultFiles) {
          console.log('File path: ' + path);
          console.log('File CID: ' + cid);
      }
      
      processVariables.set("resultFiles", resultFiles);
  } else {
      console.log('No such file!');
  }
  // complete the task
  await taskService.complete(task, processVariables);
});

// gets the file by path and returns it as JSON object
async function readIpfsFile(pathName) {
    const bufferedContents = await toBuffer(
        (await ipfs).files.read(pathName)
    );
    const jsonString = Buffer.from(bufferedContents).toString('utf8');
    const parsed =  JSON.parse(jsonString);
    return parsed;
}