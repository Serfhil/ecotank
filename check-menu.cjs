const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=function checkMenu(root,htmlPath=root+'/index.html') {
 const html=fs.readFileSync(htmlPath,'utf8');
 const title=html.match(/<div class="risingTitle"([^>]*)>([\s\S]*?)<\/div>/);
 assert(title,'Menu title container exists');
 assert(!/data-ui-text|aria-hidden/.test(title[1]),'UI text filling and aria-hidden must not remove/hide the image');
 assert(/<img[^>]*class="menuTitleImage"[^>]*src="assets\/ecotank-title.png"[^>]*alt="ECOTANK"/.test(title[2]),'Accessible image title');
 const png=fs.readFileSync(root+'/assets/ecotank-title.png');
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'7ee5ea5f3fd3e104a063de87c518b74ff16e7c62435423474e627ef85553c098','Use the complete approved PNG unchanged');
 assert.equal(png[25],6,'Preserve PNG alpha channel');
};
