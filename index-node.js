const http = require('http');
const path = require('path');
const fse = require('fs-extra');
const multiparty = require("multiparty");
const server = http.createServer();
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target');

const resolvePost= req => 
 new Promise(resolve => {
     let chunk = "";
     req.on('data', data => {
         chunk += data;
     });
     console.log('req chunk', chunk)
     req.on('end', () => {
         resolve(JSON.parse(chunk))
     });
 })

const pipeStream = (path, writeStream) => 
    new Promise(resolve => {
        const readStream = fse.createReadStream(path)
        readStream.on('end', () => {
            console.log(path)
            fse.unlinkSync(path);
            resolve()
        });
        readStream.pipe(writeStream)
    })

const mergeFileChunk = async (filePath,filename, size) => {
    const chunkDir = path.resolve(UPLOAD_DIR, filename);
    const chunkPaths = await fse.readdir(chunkDir);
    // 大文件切片按文件hash排序
    chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1])
    await Promise.all((chunkPaths, index) => 
        chunkPaths.map((chunkPath, index) => 
        pipeStream(
            path.resolve(chunkDir, chunkPaths),
            // 在指定流位置写入
            fse.createWriteStream(filePath, {
                start: index * size,
                end: (index + 1) * size
            })
        )
    )
);
fse.rmdirSync(chunkDir); 
}

const handleFormData = async (req, res) => {
    const multipart = new multiparty.Form();
    multipart.parse(req, async (err, fields, files) => {
        if (err) {
            console.error(err);
            res.status = 500;
            res.end("process file chunk failed");
            return;
        }
        // console.log(fields, files, res.data)
        const [chunk] = files.chunk;
        const [hash] = fields.hash;
        const [filename] = fields.filename;
        const filePath = path.resolve(
          UPLOAD_DIR,
          `${filename}${hash}`
        );

        const chunkDir = path.resolve(UPLOAD_DIR, hash);
        console.log('chunkDir', chunkDir)

        // 切片目录不存在，创建切片目录
        if (!fse.existsSync(chunkDir)) {
            await fse.mkdirs(chunkDir);
        }
        // fs-extra 专用方法，类似 fs.rename 并且跨平台
        // fs-extra 的 rename 方法 windows 平台会有权限问题
        // https://github.com/meteor/meteor/issues/7852#issuecomment-255767835
        // await fse.move(chunk.path, path.resolve(chunkDir, hash));
        await fse.move(chunk.path, `${chunkDir}/${hash}`);
        res.end("received file chunk");
    })
}


server.on('request', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader("Access-Control-Allow-Methods","GET","POST");
    if (req.method === 'OPTIONS') {
        res.status = 200;
        res.end();
        return;
    }
    if (req.url === "/") {
        await handleFormData(req, res);
      }
    if (req.url === '/merge') {
        const data = await resolvePost(req);
        const { filename, size } = data;
        const filePath = path.resolve(UPLOAD_DIR, `${filename}`)
        await mergeFileChunk(filePath, filename);
        res.end(JSON.stringify({
            code: 200,
            message: "file has been merged"
        }))
    }
});

server.listen(3000, () => console.log('监听3000端口'))