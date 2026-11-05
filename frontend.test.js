import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Edit odomkne skóre bez odoslania formulára tým istým kliknutím', async()=>{
 const source=fs.readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
 const start=source.indexOf("document.addEventListener('click'");
 const end=source.indexOf("document.addEventListener('change'",start);
 let click,prevented=false,focused=false;
 const inputs=[{disabled:true},{disabled:true}];
 const form={querySelectorAll:()=>inputs,elements:{a:{focus(){focused=true;}}}};
 const button={dataset:{editScore:'match-1'},type:'button',textContent:'Edit',closest:()=>form,removeAttribute(){delete this.dataset.editScore;}};
 vm.runInNewContext(source.slice(start,end),{document:{addEventListener(type,fn){if(type==='click')click=fn;}}});
 await click({target:{closest:()=>button},preventDefault(){prevented=true;}});
 assert.equal(prevented,true,'Klik nesmie spustiť predvolené odoslanie po zmene typu tlačidla.');
 assert.ok(inputs.every(input=>!input.disabled));
 assert.equal(button.textContent,'Uložiť');
 assert.equal(button.type,'submit');
 assert.equal(button.dataset.editScore,undefined);
 assert.equal(focused,true);
});
