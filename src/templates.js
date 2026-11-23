export const firmware = `#include <ArduinoJson.h>
void setup(){ Serial.begin(115200); pinMode(2, OUTPUT); }
void loop(){
  StaticJsonDocument<128> d;
  d["run"] = digitalRead(2); d["count"] = 120;
  d["temp"] = 76.5; d["press"] = 6.2; d["vib"] = 2.1; d["kw"] = 6.5;
  serializeJson(d, Serial); Serial.println();
  if (Serial.available()) { String cmd=Serial.readStringUntil('\n'); digitalWrite(2, cmd=="START"); }
  delay(1000);
}`;
const base = [
  {id:'motor',type:'motor',x:90,y:180,w:170,h:130,tag:'run',label:'MOTOR P-101'},
  {id:'tank',type:'tank',x:370,y:95,w:170,h:270,tag:'level',label:'TANK TK-01'},
  {id:'gauge',type:'gauge',x:650,y:130,w:180,h:150,tag:'temp',label:'TEMPERATURE'},
  {id:'readout',type:'readout',x:670,y:335,w:180,h:85,tag:'count',label:'PRODUCTION COUNT'},
  {id:'lamp',type:'lamp',x:110,y:420,w:160,h:85,tag:'alarm',label:'SYSTEM STATUS'},
  {id:'button',type:'button',x:380,y:420,w:160,h:82,tag:'run',label:'START / STOP'}
];
export const templates = {
  injection: { name:'เครื่องฉีดพลาสติก', items:[...base, {id:'press',type:'gauge',x:880,y:130,w:180,h:150,tag:'press',label:'HYDRAULIC BAR'}] },
  chemical: { name:'ปั๊มและถังเคมี', items:base },
  cnc: { name:'CNC & Conveyor', items:[...base, {id:'conveyor',type:'conveyor',x:80,y:560,w:760,h:80,tag:'run',label:'CONVEYOR LINE'}] },
  oven: { name:'เตาอบอุตสาหกรรม', items:[...base, {id:'oven',type:'tank',x:880,y:95,w:170,h:270,tag:'temp',label:'OVEN ZONE 1'}] }
};
