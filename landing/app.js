// ANCHOR: Accessible scenario tabs and user-controlled video; no analytics or API calls.
const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(tab,focus=false){
  tabs.forEach(item=>{const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!active;});
  if(focus)tab.focus();
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectTab(tab));
  tab.addEventListener('keydown',event=>{
    let next;
    if(event.key==='ArrowRight')next=(index+1)%tabs.length;
    if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=tabs.length-1;
    if(next!==undefined){event.preventDefault();selectTab(tabs[next],true);}
  });
});
const film=document.getElementById('product-film'),sound=document.getElementById('sound');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let autoStarted=false,userPaused=false,observerPause=false;
sound.addEventListener('click',()=>{film.muted=!film.muted;if(film.paused)film.play().catch(()=>{});});
film.addEventListener('volumechange',()=>{sound.innerHTML=film.muted?'Включить звук <span aria-hidden="true">♫</span>':'Выключить звук <span aria-hidden="true">♫</span>';sound.setAttribute('aria-pressed',String(!film.muted));});
film.addEventListener('pause',()=>{if(!observerPause)userPaused=true;observerPause=false;});
film.addEventListener('play',()=>{userPaused=false;});
if('IntersectionObserver' in window){
  new IntersectionObserver(entries=>{
    const visible=entries[0].isIntersecting;
    if(visible&&!reduced.matches&&!userPaused&&film.muted){autoStarted=true;film.play().catch(()=>{});}
    else if(!visible&&autoStarted&&!film.paused){observerPause=true;film.pause();}
  },{threshold:.3}).observe(film);
}
reduced.addEventListener('change',()=>{if(reduced.matches&&!film.paused)film.pause();});
