
const { Client, logger } = require("camunda-external-task-client-js");
const { Variables } = require("camunda-external-task-client-js");
const IPFS = require('ipfs-core');

const config = { baseUrl: "http://localhost:8082/engine-rest", use: logger };

const client = new Client(config);
const ipfs = IPFS.create();
const ROOT_DIRECTORY = '/onlab';
client.subscribe("upload-file", async function({ task, taskService }) {

  const uploadedFile = task.variables.get('uploadedFile');
  const id = task.variables.get("_id");
  const name = task.variables.get("name");

  const load = await uploadedFile.load;
  const file = await load();

  const fileName = file.filename;
  const fileContent = file.content;

  await (await ipfs).files.mkdir(ROOT_DIRECTORY + '/' + id)       // make directory by unique ID
            .catch(e => console.log(e));
  
  await (await ipfs).files.write('/'+fileName, fileContent, { create: true })       // add file to IPFS
            .catch(e => console.log(e));     

  await (await ipfs).files.mv('/' + fileName, ROOT_DIRECTORY + '/' + id)
            .catch(e => console.log(e));     // move file to new folder

  const result = await (await ipfs).files.stat(ROOT_DIRECTORY + '/' + id + '/' + fileName);

  const cid = result.cid.toString();
  const index = fileName.lastIndexOf('.');
  const fileNameWithoutExtension = fileName.substring(0, index);
  const jsonFileName = fileNameWithoutExtension + '.json';
  const dictJSON = {
        "name" : name,
        "fileCid" : cid,
        "filePath" : ROOT_DIRECTORY + '/' + id + '/' + fileName
  };
  const dictString = JSON.stringify(dictJSON);

  await (await ipfs).files.write('/'+jsonFileName, dictString, { create: true })      // add JSON file
        .catch(e => console.log(e));     

  await (await ipfs).files.mv('/' + jsonFileName, ROOT_DIRECTORY + '/' + id).catch(e => console.log(e));     // move JSON to new folder

  console.log('Path: ' + ROOT_DIRECTORY + '/' + id + '/' + fileName);
  console.log('Hash: ' + result.cid.toString());

  const processVariables = new Variables();
  processVariables.set("file", file);
  processVariables.set("path", ROOT_DIRECTORY + '/' + id + '/' + fileName);

  // complete the task
  await taskService.complete(task, processVariables);
});