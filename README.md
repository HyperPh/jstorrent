
# jstorrent

`bencoding` and `torrent` parser in javascript

Example:
```javascript
var {Torrent}=require('./jstorrent/torrent.cjs')
function test_torrent() {
    var t = new Torrent()
    t.load("./test.torrent")  // your torrent file
    console.log(t.data["info"]["name"].toString())
    var files = t.data["info"]["files"]
    for (var item of files)
        console.log(item["path"][0].toString())
    t.data["info"]["name"] = Buffer.from("my_name")  // change info.
    t.dump("./assets/dump.torrent")  // the new torrent file
}
```
