hereconst express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// =========================
// قاعدة البيانات SQLite
// =========================
const db = new sqlite3.Database("database.sqlite");

db.run(`
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    sender TEXT,
    receiver TEXT,
    phone TEXT,
    city TEXT,
    details TEXT,
    status TEXT
)
`);

function randomId(){
    return "WS" + Math.floor(100000 + Math.random()*900000);
}

// =========================
// API
// =========================

// إنشاء شحنة
app.post("/api/orders",(req,res)=>{
    const id = randomId();
    const {sender,receiver,phone,city,details} = req.body;

    db.run(
        `INSERT INTO orders (id,sender,receiver,phone,city,details,status)
         VALUES (?,?,?,?,?,?,?)`,
        [id,sender,receiver,phone,city,details,"قيد التنفيذ"],
        err=>{
            if(err) return res.status(500).json({error:err});
            res.json({id});
        }
    );
});

// تتبع شحنة
app.get("/api/orders/:id",(req,res)=>{
    db.get(
        `SELECT * FROM orders WHERE id=?`,
        [req.params.id],
        (err,row)=>{
            if(err) return res.status(500).json({error:err});
            if(!row) return res.status(404).json({message:"not found"});
            res.json(row);
        }
    );
});

// جميع الشحنات
app.get("/api/orders",(req,res)=>{
    db.all(`SELECT * FROM orders ORDER BY rowid DESC`,[],(err,rows)=>{
        res.json(rows);
    });
});

// تحديث حالة شحنة
app.put("/api/orders/:id",(req,res)=>{
    db.run(
        `UPDATE orders SET status=? WHERE id=?`,
        [req.body.status, req.params.id],
        err=>{
            if(err) return res.status(500).json({error:err});
            res.json({message:"updated"});
        }
    );
});

// =========================
// تقديم اللوجو
// =========================
app.get("/logo.bng",(req,res)=>{
    res.sendFile(path.join(__dirname,"logo.bng"));
});

// =========================
// صفحة النظام (frontend)
// =========================
app.get("/",(req,res)=>{
    res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>الوسيط للشحن</title>

<style>
body{font-family:Arial;background:#f4f6f8;margin:0}
header{background:#0e4d92;color:white;padding:20px;text-align:center}
.container{width:95%;max-width:1000px;margin:auto}
.card{background:white;padding:20px;margin:15px 0;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,.08)}
input,textarea,button{width:100%;padding:10px;margin-top:8px;border-radius:8px;border:1px solid #ccc}
button{background:#0e4d92;color:white;border:none;cursor:pointer}
.logo{width:120px;border-radius:12px}
.badge{padding:6px 10px;border-radius:8px;color:white}
.done{background:green}
.wait{background:orange}
</style>
</head>

<body>

<header>
<img src="/logo.bng" class="logo">
<h1>🚛 الوسيط للشحن</h1>
<p>السرعة اللي تريحك … والأمان اللي يطمنك</p>
</header>

<div class="container">

<div class="card">
<h2>📦 إنشاء شحنة جديدة</h2>
<input id="sender" placeholder="اسم المرسل">
<input id="receiver" placeholder="اسم المستلم">
<input id="phone" placeholder="رقم المستلم">
<input id="city" placeholder="المدينة">
<textarea id="details" placeholder="تفاصيل الشحنة"></textarea>
<button onclick="createOrder()">إنشاء الشحنة</button>
<p id="orderResult"></p>
</div>

<div class="card">
<h2>🔎 تتبع شحنة</h2>
<input id="trackNumber" placeholder="رقم الشحنة">
<button onclick="track()">تتبع</button>
<p id="trackResult"></p>
</div>

<div class="card">
<h2>📋 لوحة الشحنات</h2>
<div id="ordersList"></div>
</div>

</div>

<script>
const API = "/api";

async function createOrder(){
    let res = await fetch(API+"/orders",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            sender:sender.value,
            receiver:receiver.value,
            phone:phone.value,
            city:city.value,
            details:details.value
        })
    });
    let data = await res.json();
    orderResult.innerHTML = "تم إنشاء الشحنة ورقمها: <b>"+data.id+"</b>";
    loadOrders();
}

async function track(){
    let res = await fetch(API+"/orders/"+trackNumber.value);
    if(res.status===404){
        trackResult.innerHTML="❌ لم يتم العثور على الشحنة";
        return;
    }
    let o = await res.json();
    trackResult.innerHTML =
        "المستلم: "+o.receiver+"<br>"+
        "المدينة: "+o.city+"<br>"+
        "الحالة: "+o.status;
}

async function loadOrders(){
    let res = await fetch(API+"/orders");
    let list = await res.json();
    ordersList.innerHTML = "";
    list.forEach(o=>{
        ordersList.innerHTML += \`
        <div class='card'>
            <b>رقم الشحنة:</b> \${o.id}<br>
            <b>المرسل:</b> \${o.sender}<br>
            <b>المستلم:</b> \${o.receiver}<br>
            <b>الحالة:</b> \${o.status}<br><br>
            <button onclick="changeStatus('\${o.id}')">تغيير الحالة</button>
        </div>\`;
    });
}

async function changeStatus(id){
    let status = prompt("اكتب الحالة الجديدة");
    if(!status) return;
    await fetch(API+"/orders/"+id,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({status})
    });
    loadOrders();
}

loadOrders();
</script>

</body>
</html>`);
});

// =========================
// تشغيل السيرفر
// =========================
app.listen(3000, ()=> console.log("Running on http://localhost:3000"));
