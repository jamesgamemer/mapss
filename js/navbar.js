/* ============================================================
   NAVBAR SYSTEM (v2 - Separate Admin/User Auth)
   ============================================================ */

/* NAV MAP */
const navMap = {
  'index.html': { icon: '🏠', key: 'nav_home' },
  'characters.html': { icon: '⚔', key: 'nav_characters' },
  'weapons.html': { icon: '🗡', key: 'nav_weapons' },
  'tierlist.html': { icon: '🏆', key: 'nav_tierlist' },
  'events.html': { icon: '🎉', key: 'nav_events' },
  'guides.html': { icon: '📘', key: 'nav_guides' }
};


/* ============================================================
   INIT NAVBAR
   ============================================================ */

function initNavbar(){

if(window._navbarInitDone) return;
window._navbarInitDone = true;

/* render menu */
renderNavbar();

/* language buttons */
setupLangSwitch();

/* auth menu */
injectAuthUI();

/* hamburger */
setupHamburger();

/* apply translation */
applyNavI18n();

/* listen language change */
if(typeof I18n !== 'undefined'){
  I18n.onChange(function(){
    applyNavI18n();
  });
}

}


/* ============================================================
   RENDER NAVBAR
   ============================================================ */

function renderNavbar(){

document.querySelectorAll('.navbar-links > li > a').forEach(function(a){

var href = a.getAttribute('href');
if(!href) return;

var page = href.split('/').pop();
var mapping = navMap[page];
if(!mapping) return;

a.innerHTML='';

var icon=document.createElement("span");
icon.className="nav-icon";
icon.innerHTML=mapping.icon;

var text=document.createElement("span");
text.className="nav-text";
text.textContent=getLabel(mapping.key);

a.appendChild(icon);
a.appendChild(document.createTextNode(' '));
a.appendChild(text);

});

}


/* ============================================================
   LANGUAGE UPDATE
   ============================================================ */

function applyNavI18n(){

document.querySelectorAll('.navbar-links > li > a').forEach(function(a){

var href=a.getAttribute('href');
if(!href) return;

var page=href.split('/').pop();
var mapping=navMap[page];
if(!mapping) return;

var text=a.querySelector('.nav-text');

if(text){
text.textContent=getLabel(mapping.key);
}

});

}


/* ============================================================
   LANGUAGE SWITCH
   ============================================================ */

function setupLangSwitch(){

var navLinks=document.getElementById('navLinks');
if(!navLinks||navLinks.querySelector('.nav-lang-switcher')) return;

var li=document.createElement('li');
li.className='nav-lang-switcher';

var current=getLang();

li.innerHTML=
'<div class="lang-switch-group">'+
'<button class="lang-btn '+(current==='en'?'active':'')+'" data-lang="en">EN</button>'+
'<span class="lang-divider">|</span>'+
'<button class="lang-btn '+(current==='th'?'active':'')+'" data-lang="th">TH</button>'+
'</div>';

navLinks.appendChild(li);

li.querySelectorAll('.lang-btn').forEach(function(btn){

btn.addEventListener('click',function(){

var lang=btn.dataset.lang;

if(typeof I18n!=='undefined'){
I18n.setLang(lang);
}

li.querySelectorAll('.lang-btn').forEach(function(b){
b.classList.toggle('active',b.dataset.lang===lang);
});

applyNavI18n();

});

});

}


/* ============================================================
   HAMBURGER
   ============================================================ */

function setupHamburger(){

var ham=document.getElementById('navHam');
var links=document.getElementById('navLinks');

if(ham&&links){
ham.addEventListener('click',function(){
links.classList.toggle('open');
});
}

}


/* ============================================================
   AUTH MENU (v2 - Separate Admin and User)
   
   Logic:
   1. Check if user is ADMIN (email/password + in ADMIN_EMAILS)
      -> Show admin avatar with admin menu (Dashboard, Logout)
   2. Else check if user is logged in via UserAuth (Google/Discord/Email)
      -> Show user avatar with user menu (Profile info, Sign Out)
   3. Else show Login button (for admin) + Sign In text
   ============================================================ */

async function injectAuthUI(){

var navLinks=document.getElementById('navLinks');
if(!navLinks||navLinks.querySelector('.nav-auth-item')) return;

var li=document.createElement('li');
li.className='nav-auth-item';

/* ── Step 1: Check Admin ── */
var isAdmin=false;
var adminEmail='';

if(typeof Auth!=='undefined'){
  try{
    isAdmin=await Auth.isLoggedIn();
    if(isAdmin && typeof Auth.getAdminEmail === 'function'){
      adminEmail = await Auth.getAdminEmail();
    }
    if(isAdmin && !adminEmail && typeof SupaDB!=='undefined'){
      var session=await SupaDB.getSession();
      if(session&&session.user){
        adminEmail=session.user.email||'';
      }
    }
  }catch(e){
    console.warn('[Navbar] Admin check error:', e);
  }
}

if(isAdmin){
  /* Admin UI: show admin avatar + admin menu */
  var initial=adminEmail?adminEmail.charAt(0).toUpperCase():'A';

  li.innerHTML=
  '<div class="nav-profile-wrapper">'+
  '<button class="nav-profile-avatar nav-admin-avatar" id="profileAvatarBtn" title="Admin: '+escNavHtml(adminEmail)+'">'+initial+'</button>'+
  '<div class="nav-profile-menu" id="profileMenu">'+
  '<div class="profile-menu-header">'+
  '<span class="profile-menu-role">ADMIN</span>'+
  '<span class="profile-menu-email">'+escNavHtml(adminEmail)+'</span>'+
  '</div>'+
  '<div class="profile-menu-divider"></div>'+
  '<a href="admin.html" class="profile-menu-item">&#128202; Dashboard</a>'+
  '<a href="characters.html" class="profile-menu-item">&#9876; Characters</a>'+
  '<a href="tierlist.html" class="profile-menu-item">&#127942; Tier List</a>'+
  '<a href="events.html" class="profile-menu-item">&#127881; Events</a>'+
  '<a href="guides.html" class="profile-menu-item">&#128218; Guides</a>'+
  '<div class="profile-menu-divider"></div>'+
  '<button class="profile-menu-item logout-item" onclick="Auth.logout()">&#128682; Logout</button>'+
  '</div>'+
  '</div>';

  navLinks.appendChild(li);
  _bindProfileMenu();
  return;
}

/* ── Step 2: Check User Auth (Google/Discord/Email signup) ── */
var isUser=false;
var userName='';
var userAvatar='';

if(typeof UserAuth!=='undefined'){
  try{
    /* UserAuth might not be initialized yet on non-team-builder pages */
    /* Initialize it if Supabase is connected */
    if(typeof SupaDB!=='undefined' && SupaDB.isConnected()){
      await UserAuth.init();
    }
    isUser=UserAuth.isLoggedIn();
    if(isUser){
      userName=UserAuth.getDisplayName()||'User';
      userAvatar=UserAuth.getAvatarUrl()||'';
    }
  }catch(e){
    console.warn('[Navbar] UserAuth check error:', e);
  }
}

if(isUser){
  /* User UI: show user avatar + user menu */
  var avatarHtml;
  if(userAvatar){
    avatarHtml='<img class="nav-profile-avatar nav-user-avatar" id="profileAvatarBtn" src="'+escNavHtml(userAvatar)+'" alt="'+escNavHtml(userName)+'" title="'+escNavHtml(userName)+'">';
  } else {
    var userInitial=userName?userName.charAt(0).toUpperCase():'U';
    avatarHtml='<button class="nav-profile-avatar nav-user-avatar" id="profileAvatarBtn" title="'+escNavHtml(userName)+'">'+userInitial+'</button>';
  }

  li.innerHTML=
  '<div class="nav-profile-wrapper">'+
  avatarHtml+
  '<div class="nav-profile-menu" id="profileMenu">'+
  '<div class="profile-menu-header">'+
  '<span class="profile-menu-name">'+escNavHtml(userName)+'</span>'+
  '</div>'+
  '<div class="profile-menu-divider"></div>'+
  '<a href="team-builder.html" class="profile-menu-item">&#9881; Team Builder</a>'+
  '<div class="profile-menu-divider"></div>'+
  '<button class="profile-menu-item logout-item" id="navUserLogout">&#128682; Sign Out</button>'+
  '</div>'+
  '</div>';

  navLinks.appendChild(li);
  _bindProfileMenu();

  /* Bind user logout */
  var logoutBtn=document.getElementById('navUserLogout');
  if(logoutBtn){
    logoutBtn.addEventListener('click', async function(){
      if(typeof UserAuth!=='undefined'){
        await UserAuth.logout();
        window.location.reload();
      }
    });
  }
  return;
}

/* ── Step 3: Not logged in - Show Login button ── */
li.innerHTML=
'<a href="login.html" class="nav-login-btn">'+
'<span class="nav-login-icon">&#128274;</span> Login'+
'</a>';

navLinks.appendChild(li);

}

/* ── Bind profile menu toggle ── */
function _bindProfileMenu(){
var avatar=document.getElementById('profileAvatarBtn');
var menu=document.getElementById('profileMenu');
if(!avatar||!menu) return;

avatar.addEventListener('click',function(e){
  e.stopPropagation();
  menu.classList.toggle('open');
});

document.addEventListener('click',function(e){
  if(!menu.contains(e.target)&&e.target!==avatar){
    menu.classList.remove('open');
  }
});
}


/* ============================================================
   UTIL
   ============================================================ */

function getLabel(key){

if(typeof I18n!=='undefined'){
return I18n.t(key);
}

return key;

}

function getLang(){

if(typeof I18n!=='undefined'){
return I18n.getLang();
}

return 'en';

}

function escNavHtml(str){
var div=document.createElement('div');
div.textContent=str||'';
return div.innerHTML;
}


/* ============================================================
   START
   ============================================================ */

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',initNavbar);
}else{
initNavbar();
}
