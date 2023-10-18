/**
jstorrent 是一个非常小巧的用来解析torrent文件的js库。核心代码不足200行，却能够完备地解析torrent文件，并支持导出修改后的torrent文件。
该库把torrent文件的dict,list,integer,string映射到js的Object,Array,bigint,string四种类型，直接操作这四种数据就能读取和修改torrent文件的一切信息。

 注意：值中的字符串全是Buffer(即bytes)，没有string
 注：本来把integer解析为number(注释部分的代码，查找parseInt即可找到)，但由于可能溢出，改为了bigint
*/

const fs=require('fs')


// ///////读取文件

/**call after symbol 'd' found*/
function build_dic(stream){
    var list=[]
    proxy_build(stream,list)
    var dic={}
    for(var i=0;i<list.length-1;i+=2){//convert a list[k1,v1,k2,v2...] to a dic
        dic[list[i]]=list[i+1]
    }   
        
    return dic
}

/**call after symbol 'l' found*/
function build_list(stream){
    var list=[]
    proxy_build(stream,list)
    return list
}

/**call after num found*/
function build_str(stream,str_len){
    var values=[]
    for(var i=0;i<str_len;i++) {
        values.push(stream.next())
    }
    return Buffer.from(values)
}

/**call after symbol 'i' found*/
function build_num(stream){
    // var num=0
    var num=0n
    // var minus=1
    var minus=1n
    while (true){
        var ch=stream.next()
        if (ch>='0'.codePointAt(0) && ch<='9'.codePointAt(0))
            // num=num*10+parseInt(String.fromCodePoint(ch))
            num=num*10n+BigInt(String.fromCodePoint(ch))
        else if (ch=='-'.codePointAt(0))
            minus=-1n
        else if (ch=='e'.codePointAt(0))
            break
        else
            throw Error("invalid torrent file")
    }
    num*=minus
    return num
}

//because build_dic and build_list is similar,so I def a proxy-function
function proxy_build(stream,list){
    while (true){
        var ch=stream.next()
        if (ch>='0'.codePointAt(0) && ch<='9'.codePointAt(0)) {//I think ch==0 is not very valid, but just do this.
            // var str_len = parseInt(String.fromCodePoint(ch))
            var str_len = BigInt(String.fromCodePoint(ch))
            while (true) {
                ch = stream.next()
                if (ch == ':'.codePointAt(0))
                    break
                else if (ch >= '0'.codePointAt(0) && ch <= '9'.codePointAt(0))
                    // str_len = str_len * 10 + parseInt(String.fromCodePoint(ch))
                    str_len = str_len * 10n + BigInt(String.fromCodePoint(ch))
                else
                    throw Error("invalid torrent file")
            }
            list.push(build_str(stream, str_len))
        }
        else if (ch=='l'.codePointAt(0))
            list.push(build_list(stream))
        else if (ch=='i'.codePointAt(0))
            list.push(build_num(stream))
        else if (ch=='d'.codePointAt(0))
            list.push(build_dic(stream))
        else if (ch=='e'.codePointAt(0))
            break
        else
            throw Error("invalid torrent file")
    }
}

// //////写入文件

/***/
function dump_dic(stream,dic){
    stream.put(Buffer.from("d"))
    for (var k of Object.keys(dic)) {
        dump_str(stream, k)
        proxy_dump(stream, dic[k])
    }
    stream.put(Buffer.from("e"))
}

/***/
function dump_list(stream,list){
    stream.put(Buffer.from("l"))
    for (var item of list)
        proxy_dump(stream,item)
    stream.put(Buffer.from("e"))
}

/***/
function dump_str(stream,mystr){
    stream.put(Buffer.from(mystr.length.toString()+":"))
    stream.put(mystr)
}

/***/
function dump_num(stream,num){
    stream.put(Buffer.from("i"))
    stream.put(Buffer.from(num.toString()))
    stream.put(Buffer.from("e"))
}

/***/
function proxy_dump(stream,item){
    switch (Object.prototype.toString.call(item)) {
        case '[object Object]':
            dump_dic(stream,item)
            break
        case '[object Array]':
            dump_list(stream,item)
            break
        case '[object Uint8Array]':
            dump_str(stream,item)
            break
        case '[object Number]':
            dump_num(stream,item)
            break
        case '[object BigInt]':
            dump_num(stream,item)
            break
        default:
            throw Error("dump info error")
    }
}


// //////读写流。必须用流式读写，否则不易解析torrent文件结构

//bytes stream
class Stream{

    //mode in ('r', 'w')
    constructor(filename, mode) {
        this.file = fs.openSync(filename, mode)
    }
    
    //for mode r
    next(){
        const buf1=Buffer.alloc(1)
        // var bytes_num_read = fs.readSync(this.file,buf1,0,1)//下面是等价写法
        var bytes_num_read = fs.readSync(this.file,buf1)
        return buf1[0]
    }

    //for mode w
    put(byte){
        fs.writeSync(this.file,byte)
    }
    
    close(){
        fs.closeSync(this.file)
    }
    
}


/**
 * 包装类
 a class to parser torrent file.
 it can get info from the file,
 and dump to a new file.

 注意：与python不同的是，build_dic时会把对象的键都自动调用toString转为string(而Buffer的toString就是对utf-8解码)
 因此data中的一切 键都是string类型，值都是Buffer(即bytes),bigint(即int),Array(即list),Object(即dict)类型
 */
class Torrent{

    constructor() {
        this.data = {}
    }

    load(filename){
        this.stream=new Stream(filename,"r")
        if (this.stream.next()=='d'.codePointAt(0))
            this.data=build_dic(this.stream)
        else {
            this.stream.close()
            throw Error("invalid torrent file")
        }
        this.stream.close()
    }

    dump(filename) {
        this.stream = new Stream(filename, "w")
        dump_dic(this.stream, this.data)
        this.stream.close()
    }

}

exports.Torrent=Torrent
module.exports=exports
