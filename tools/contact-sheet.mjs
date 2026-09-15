import sharp from 'sharp';import fs from 'node:fs';import {cars}from'../src/data.js';
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
for(let start=0;start<cars.length;start+=24){const entries=[];for(const [j,c]of cars.slice(start,start+24).entries()){
 const path=`public/images/cars/${c.id}.webp`;if(!fs.existsSync(path))continue;
 const input=await sharp(path).resize(230,140,{fit:'contain',background:'#26332d'}).png().toBuffer();entries.push({input,left:j%4*250,top:Math.floor(j/4)*170});entries.push({input:Buffer.from(`<svg width="250" height="30"><text x="5" y="20" font-size="12" fill="white">${esc(c.name)}</text></svg>`),left:j%4*250,top:Math.floor(j/4)*170+140});
}await sharp({create:{width:1000,height:1020,channels:3,background:'#26332d'}}).composite(entries).png().toFile(`/tmp/catalogue-${start/24}.png`);}
