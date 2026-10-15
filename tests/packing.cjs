const fs=require('fs'),vm=require('vm'),assert=require('assert');
let code=fs.readFileSync('script.js','utf8');code=code.slice(0,code.indexOf('els.unitSelect.value = currentUnit;'))+code.slice(code.indexOf('function onUnitChange()'));
const ctx={document:{getElementById:()=>({}),querySelector:()=>({})},console};vm.createContext(ctx);vm.runInContext(code,ctx);
vm.runInContext(`
kerfMm=0;
const stock=[{id:'s',material:'MDF',length:8,width:4,available:100}];
const p=(length,width,qty,direction='vertical')=>({material:'MDF',length,width,qty,direction});
if(planCutting(stock,[p(4,2,4)]).totals.sheetsUsed!==1) throw Error('exact fit');
if(planCutting(stock,[p(6,2,1,'horizontal')]).totals.piecesPlaced!==0) throw Error('direction violated');
if(planCutting(stock,[p(6,2,1)]).totals.piecesPlaced!==1) throw Error('vertical missing');
kerfMm=.1;
if(planCutting(stock,[p(4,2,4)]).totals.sheetsUsed===1) throw Error('kerf ignored');
if(planCutting([{...stock[0],available:1}],[p(8,4,2)]).totals.piecesPlaced!==1) throw Error('stock exceeded');
currentUnit='mm'; if(formatDim(1200)!=='1200') throw Error('dimensions truncated');
let seed=19; const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let trial=0;trial<80;trial++) {
 const pieces=Array.from({length:10},()=>p(1+random()*6,.5+random()*3,1+Math.floor(random()*3),random()>.5?'vertical':'horizontal'));
 const result=planCutting(stock,pieces);
 for(const s of result.sheets){
  for(const a of s.placements){
   if(a.x<0||a.y<0||a.x+a.width>s.width+1e-6||a.y+a.height>s.length+1e-6)throw Error('bounds');
   if(a.width!==(a.rotated?a.sourceLength:a.sourceWidth))throw Error('orientation');
   for(const b of s.placements)if(a!==b&&a.x<b.x+b.width-1e-7&&a.x+a.width>b.x+1e-7&&a.y<b.y+b.height-1e-7&&a.y+a.height>b.y+1e-7)throw Error('overlap');
  }
 }
}
kerfMm = 3;
const foot = 304.8;
const example = planCutting([{id:'example',material:'MDF',length:8*foot,width:4*foot,available:1}], [p(3*foot,3.5*foot,1),p(2*foot,3.4*foot,1),p(3.7*foot,2*foot,1,'horizontal')]);
if(example.totals.sheetsUsed!==1 || example.totals.piecesPlaced!==3) throw Error('example sheet count');
// Test remnant quality rather than imposing a particular piece order.
if(!example.sheets[0].freeRects.some(r=>r.height>5.9*foot && r.width>.48*foot)) throw Error('continuous side remnant missing');
for(const sheet of example.sheets) for(const a of sheet.freeRects) {
  if(a.x<0||a.y<0||a.x+a.width>sheet.width+1e-6||a.y+a.height>sheet.length+1e-6) throw Error('offcut bounds');
  for(const b of [...sheet.placements,...sheet.freeRects]) if(a!==b && a.x<b.x+b.width-1e-7 && a.x+a.width>b.x+1e-7 && a.y<b.y+(b.height)-1e-7 && a.y+a.height>b.y+1e-7) throw Error('offcut overlaps');
}
console.log('Passed: direction locks, kerf, stock limits, units, 80 randomized cases, and continuous-remnant regression.');
`,ctx);

const dimensionValues = {};
ctx.document.getElementById = id => ({value: dimensionValues[id] ?? '', validity: {badInput: false}});
Object.assign(dimensionValues, {'piece-length-feet':'2','piece-length-inches':'6','piece-length-sootar':'4'});
assert.ok(Math.abs(vm.runInContext('readPieceDimension("length")',ctx)-774.7)<1e-8);
dimensionValues['piece-length-feet']='';dimensionValues['piece-length-inches']='';dimensionValues['piece-length-sootar']='8';
assert.ok(Math.abs(vm.runInContext('readPieceDimension("length")',ctx)-25.4)<1e-8);
vm.runInContext('currentUnit="m"',ctx);
assert.ok(Math.abs(vm.runInContext('readPieceDimension("length")',ctx)-25.4)<1e-8);
dimensionValues['piece-length-sootar']='-1';
assert.ok(Number.isNaN(vm.runInContext('readPieceDimension("length")',ctx)));
console.log('Passed: compound dimensions, blank fields, sootar conversion, unit independence, negative validation.');
