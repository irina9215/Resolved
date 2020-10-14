## 大文件上传

前端上传大文件时使用 Blob.prototype.slice 将文件切片，并发上传多个切片，最后发送一个合并的请求通知服务端合并切片
服务端接收切片并存储，收到合并请求后使用流将切片合并到最终文件
原生 XMLHttpRequest 的 upload.onprogress 对切片上传进度的监听
使用 Vue 计算属性根据每个切片的进度算出整个文件的上传进度

## 断点续传

使用 spark-md5 根据文件内容算出文件 hash
通过 hash 可以判断服务端是否已经上传该文件，从而直接提示用户上传成功（秒传）
通过 XMLHttpRequest 的 abort 方法暂停切片的上传
上传前服务端返回已经上传的切片名，前端跳过这些切片的上传
