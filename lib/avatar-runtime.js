import { getPieceTransform, pieceTransformAttribute } from './avatar-pieces.js';
import { clampPose, NEUTRAL_POSE } from './avatar-pose.js';
  const COLORS = {
    skin: {
      porcelain: '#F8DCCB', fair: '#F0C5A8', rosy: '#E7B092', warm: '#DDA17C', tan: '#C88662', brown: '#986046', deep: '#67412F'
    },
    hair: {
      black: '#22212A', espresso: '#332522', darkBrown: '#4A302A', brown: '#684238', auburn: '#8A4435', copper: '#B95F3E', strawberry: '#C87958', blonde: '#D5B56F', ashBlonde: '#BBA77B', gray: '#8B8F98', white: '#EEE9DF'
    },
    eyes: { blue: '#5C83A9', grayBlue: '#748798', green: '#6E8C72', hazel: '#8B774D', brown: '#64483A', dark: '#2E3037' },
    outfit: { navy: '#263F79', blue: '#4D77C5', teal: '#3E8587', charcoal: '#424754', black: '#2D303A', red: '#B94A53', green: '#4E765D', gray: '#7A8190', cream: '#D9CBB3', white: '#E9E6DF' },
    accent: { yellow: '#D6A93A', green: '#42785B', blue: '#557AAE', teal: '#3E8587', red: '#B84E55', gray: '#6D7380', brown: '#75513C', black: '#2B2D35' }
  };

  const OPTIONS = {
    faceShape: ['round','oval','long','square','heart','softSquare','diamond'],
    skin: Object.keys(COLORS.skin),
    ageDetail: ['none','smileLines','forehead','mature'],
    hairStyle: ['none','buzz','crop','spikyCrop','sidepart','sweptUp','receding','waves','bob','layeredBob','pixie','shortCurls','tightCurls','shoulderCurls','long','lowPony','ponytail','bun','braid'],
    hairColor: Object.keys(COLORS.hair),
    browStyle: ['soft','straight','arched','thick','fine','raised'],
    browColor: Object.keys(COLORS.hair),
    eyeStyle: ['round','almond','narrow','happy','wide','soft','lashes'],
    eyeColor: Object.keys(COLORS.eyes),
    noseStyle: ['dot','small','round','straight','wide','long','button'],
    mouthStyle: ['smile','toothy','wideSmile','smirk','softSmile','open','neutral','thinSmile'],
    glasses: ['none','square','softSquare','round','catEye','sunglasses'],
    facialHair: ['none','stubble','moustache','goatee','shortBeard','fullBeard'],
    facialHairColor: Object.keys(COLORS.hair),
    outfit: ['tee','tank','polo','button','openShirt','overshirt','plaid','floral','dress','suit','hoodie','vest','pfd'],
    outfitColor: Object.keys(COLORS.outfit),
    hat: ['none','blackCap','grayCap','sunHat','bucketHat','beanie'],
    extras: ['freckles','earrings','necklace','crossbody','choker'],
    bodyBuild: ['slim','average','broad'],
    signatureDetail: ['none','sunsetFlorals','capPatch','redCapMark','wovenStrap','tropicalPrint','starTattoos','outdoorStrap','geometricTop','blueFrames']
  };

  const FEATURE_CATEGORIES = [
    { id:'face', label:'Face', icon:'◯' },
    { id:'hair', label:'Hair', icon:'✦' },
    { id:'brows', label:'Brows', icon:'⌁' },
    { id:'eyes', label:'Eyes', icon:'◉' },
    { id:'nose', label:'Nose', icon:'△' },
    { id:'mouth', label:'Mouth', icon:'⌣' },
    { id:'facialHair', label:'Beard', icon:'〰' },
    { id:'glasses', label:'Glasses', icon:'▣' },
    { id:'outfit', label:'Outfit', icon:'▥' },
    { id:'extras', label:'Extras', icon:'＋' },
    { id:'body', label:'Body', icon:'↕' }
  ];

  const DEFAULT_AVATAR = {
    schemaVersion:2,
    faceShape:'oval', skin:'fair', ageDetail:'none', faceWidth:1, faceHeight:1,
    hairStyle:'sidepart', hairColor:'brown', hairFlip:false, hairline:0,
    browStyle:'soft', browColor:'brown', browAngle:0, browHeight:0, browSpacing:0,
    eyeStyle:'almond', eyeColor:'blue', eyeSize:1, eyeSpacing:0, eyeHeight:0, eyeTilt:0,
    noseStyle:'small', noseSize:1, noseHeight:0,
    mouthStyle:'smile', mouthWidth:1, mouthHeight:0,
    glasses:'none', glassesColor:'black', glassesSize:1, glassesHeight:0,
    facialHair:'none', facialHairColor:'brown', facialHairSize:1,
    outfit:'tee', outfitColor:'blue', outfitAccent:'yellow',
    hat:'none', extras:[], bodyBuild:'average', bodyHeight:1, bodyWidth:1, signatureDetail:'none',
    personality:'none'
  };

  const FAMILY_PRESETS = {
    Virginia: {
      note:'Round rosy face · layered brown hair · sunhat + sunglasses · bright floral top',
      avatar:{...DEFAULT_AVATAR, faceShape:'round', skin:'rosy', ageDetail:'smileLines', faceWidth:1.08, faceHeight:.97, hairStyle:'bob', hairColor:'brown', hairline:1, browStyle:'soft', browColor:'brown', eyeStyle:'soft', eyeColor:'brown', eyeSize:.96, eyeSpacing:1, noseStyle:'round', noseSize:1.03, mouthStyle:'wideSmile', mouthWidth:1.08, glasses:'sunglasses', glassesSize:1.05, glassesHeight:-1, outfit:'floral', outfitColor:'white', outfitAccent:'blue', hat:'sunHat', extras:[], bodyBuild:'average', bodyWidth:1.08, signatureDetail:'sunsetFlorals', personality:'glasses'}
    },
    Gregory: {
      note:'Broad square face · rectangular black glasses · full white beard · black cap',
      avatar:{...DEFAULT_AVATAR, faceShape:'softSquare', skin:'rosy', ageDetail:'mature', faceWidth:1.12, faceHeight:1, hairStyle:'receding', hairColor:'white', hairline:2, browStyle:'thick', browColor:'gray', eyeStyle:'soft', eyeColor:'brown', eyeSize:.93, eyeSpacing:2, noseStyle:'wide', noseSize:1.1, mouthStyle:'softSmile', mouthWidth:.98, glasses:'softSquare', glassesSize:1.09, facialHair:'fullBeard', facialHairColor:'white', facialHairSize:1.1, outfit:'polo', outfitColor:'blue', hat:'blackCap', bodyBuild:'broad', bodyWidth:1.1, signatureDetail:'capPatch', personality:'beard'}
    },
    Aaron: {
      note:'Long narrow face · blue-gray eyes · red-marked black cap · gray tee + black strap',
      avatar:{...DEFAULT_AVATAR, faceShape:'long', skin:'fair', faceWidth:.94, faceHeight:1.08, hairStyle:'crop', hairColor:'darkBrown', hairline:1, browStyle:'straight', browColor:'darkBrown', eyeStyle:'narrow', eyeColor:'grayBlue', eyeSize:.95, eyeSpacing:0, noseStyle:'straight', noseSize:1.02, mouthStyle:'thinSmile', mouthWidth:1.02, facialHair:'none', outfit:'tee', outfitColor:'gray', hat:'blackCap', extras:['crossbody'], bodyBuild:'slim', bodyHeight:1.06, bodyWidth:.94, signatureDetail:'redCapMark', personality:'hat'}
    },
    Liv: {
      note:'Short copper curls · joyful squint · wide smile · earrings + woven strap',
      avatar:{...DEFAULT_AVATAR, faceShape:'heart', skin:'fair', faceWidth:.99, faceHeight:.99, hairStyle:'tightCurls', hairColor:'copper', hairline:-2, browStyle:'arched', browColor:'copper', browAngle:4, browHeight:1, eyeStyle:'happy', eyeColor:'green', eyeSize:1.03, eyeSpacing:0, noseStyle:'small', noseSize:.92, mouthStyle:'wideSmile', mouthWidth:1.16, mouthHeight:-1, outfit:'overshirt', outfitColor:'charcoal', outfitAccent:'yellow', hat:'none', extras:['earrings','crossbody'], bodyBuild:'slim', bodyWidth:.94, signatureDetail:'wovenStrap', personality:'curls'}
    },
    Danny: {
      note:'Tall narrow face · swept-up auburn hair · bright blue eyes · freckles + tropical shirt',
      avatar:{...DEFAULT_AVATAR, faceShape:'long', skin:'fair', faceWidth:.93, faceHeight:1.09, hairStyle:'sweptUp', hairColor:'brown', hairline:-1, browStyle:'straight', browColor:'brown', browHeight:1, eyeStyle:'almond', eyeColor:'blue', eyeSize:1.05, eyeSpacing:-1, noseStyle:'straight', noseSize:1.05, noseHeight:1, mouthStyle:'wideSmile', mouthWidth:1.1, facialHair:'none', outfit:'openShirt', outfitColor:'blue', outfitAccent:'teal', hat:'none', extras:['freckles'], bodyBuild:'slim', bodyHeight:1.1, bodyWidth:.9, signatureDetail:'tropicalPrint', personality:'none'}
    },
    Kristin: {
      note:'Soft oval face · strawberry-blonde tied-back hair · blue eyes · black top + tiny stars',
      avatar:{...DEFAULT_AVATAR, faceShape:'oval', skin:'fair', faceWidth:.98, faceHeight:1.04, hairStyle:'lowPony', hairColor:'strawberry', hairline:1, browStyle:'fine', browColor:'strawberry', browHeight:1, eyeStyle:'soft', eyeColor:'blue', eyeSize:.99, eyeSpacing:1, noseStyle:'straight', noseSize:.94, mouthStyle:'wideSmile', mouthWidth:1.12, outfit:'tank', outfitColor:'black', hat:'none', extras:['crossbody'], bodyBuild:'slim', bodyWidth:.94, signatureDetail:'starTattoos', personality:'none'}
    },
    Doug: {
      note:'Long soft face · rectangular glasses · gray stubble · trail hat + black strap',
      avatar:{...DEFAULT_AVATAR, faceShape:'long', skin:'rosy', ageDetail:'smileLines', faceWidth:.98, faceHeight:1.04, hairStyle:'receding', hairColor:'gray', hairline:2, browStyle:'straight', browColor:'gray', browHeight:1, eyeStyle:'soft', eyeColor:'hazel', eyeSize:.96, eyeSpacing:1, noseStyle:'long', noseSize:1.04, mouthStyle:'toothy', mouthWidth:1.04, glasses:'square', glassesSize:1.07, glassesHeight:1, facialHair:'stubble', facialHairColor:'gray', facialHairSize:.96, outfit:'tee', outfitColor:'charcoal', hat:'bucketHat', extras:['crossbody'], bodyBuild:'average', bodyHeight:1.04, bodyWidth:1.01, signatureDetail:'outdoorStrap', personality:'glasses'}
    },
    Ruth: {
      note:'Soft oval face · short light curls · bright eyes · broad smile + geometric top',
      avatar:{...DEFAULT_AVATAR, faceShape:'oval', skin:'fair', ageDetail:'smileLines', faceWidth:1.01, faceHeight:1.01, hairStyle:'waves', hairColor:'ashBlonde', hairline:-1, browStyle:'soft', browColor:'ashBlonde', browHeight:1, eyeStyle:'soft', eyeColor:'grayBlue', eyeSize:1.05, eyeSpacing:0, noseStyle:'small', noseSize:.95, mouthStyle:'wideSmile', mouthWidth:1.13, mouthHeight:-1, outfit:'dress', outfitColor:'gray', outfitAccent:'red', hat:'none', extras:['earrings'], bodyBuild:'slim', bodyWidth:.95, signatureDetail:'geometricTop', personality:'none'}
    },
    Judy: {
      note:'Round face · copper bob + bangs · blue soft-square glasses · blue plaid',
      avatar:{...DEFAULT_AVATAR, faceShape:'round', skin:'fair', ageDetail:'smileLines', faceWidth:1.05, faceHeight:1, hairStyle:'bob', hairColor:'auburn', hairline:-2, browStyle:'soft', browColor:'auburn', eyeStyle:'soft', eyeColor:'brown', eyeSize:.99, eyeSpacing:1, noseStyle:'round', noseSize:1.04, mouthStyle:'wideSmile', mouthWidth:1.1, glasses:'softSquare', glassesSize:1.08, glassesHeight:1, facialHair:'none', outfit:'plaid', outfitColor:'blue', outfitAccent:'black', hat:'none', bodyBuild:'average', bodyWidth:1.02, signatureDetail:'blueFrames', personality:'glasses'}
    },
    Brandon: {
      note:'Long narrow face · tidy dark side-part · blue-gray eyes · close beard + green tie',
      avatar:{...DEFAULT_AVATAR, faceShape:'long', skin:'fair', faceWidth:.93, faceHeight:1.08, hairStyle:'sidepart', hairColor:'darkBrown', hairline:1, browStyle:'straight', browColor:'darkBrown', browHeight:1, eyeStyle:'almond', eyeColor:'grayBlue', eyeSize:.99, eyeSpacing:0, noseStyle:'straight', noseSize:1.01, noseHeight:1, mouthStyle:'wideSmile', mouthWidth:1.08, facialHair:'stubble', facialHairColor:'darkBrown', facialHairSize:.92, outfit:'suit', outfitColor:'gray', outfitAccent:'green', hat:'none', bodyBuild:'slim', bodyHeight:1.07, bodyWidth:.92, personality:'none'}
    },
    Emily: {
      note:'Soft heart face · shoulder-length dark curls · blue eyes · red layers + choker',
      avatar:{...DEFAULT_AVATAR, faceShape:'heart', skin:'fair', faceWidth:1, faceHeight:1.01, hairStyle:'shoulderCurls', hairColor:'darkBrown', hairline:-1, browStyle:'arched', browColor:'darkBrown', browAngle:3, eyeStyle:'lashes', eyeColor:'blue', eyeSize:1.05, eyeSpacing:0, noseStyle:'small', noseSize:.93, mouthStyle:'wideSmile', mouthWidth:1.15, mouthHeight:-1, outfit:'dress', outfitColor:'red', outfitAccent:'red', hat:'none', extras:['choker','necklace'], bodyBuild:'slim', bodyWidth:.96, personality:'curls'}
    },
    Jaclyne: {
      note:'Soft oval face · dark braid under gray cap · bright eyes · green river PFD',
      avatar:{...DEFAULT_AVATAR, faceShape:'oval', skin:'fair', faceWidth:1, faceHeight:1.01, hairStyle:'braid', hairColor:'darkBrown', hairline:1, browStyle:'soft', browColor:'darkBrown', browHeight:1, eyeStyle:'almond', eyeColor:'grayBlue', eyeSize:1.03, eyeSpacing:0, noseStyle:'small', noseSize:.96, mouthStyle:'wideSmile', mouthWidth:1.12, outfit:'pfd', outfitColor:'green', outfitAccent:'black', hat:'grayCap', extras:[], bodyBuild:'slim', bodyHeight:1.02, bodyWidth:.95, personality:'hat'}
    },
    Alex: {
      note:'Tall narrow face · tousled blond hair · blue eyes · stubble + outdoorsy teal',
      avatar:{...DEFAULT_AVATAR, faceShape:'long', skin:'fair', faceWidth:.94, faceHeight:1.08, hairStyle:'sweptUp', hairColor:'blonde', hairline:1, browStyle:'straight', browColor:'ashBlonde', browHeight:1, eyeStyle:'almond', eyeColor:'blue', eyeSize:1.02, eyeSpacing:0, noseStyle:'straight', noseSize:1, mouthStyle:'wideSmile', mouthWidth:1.11, facialHair:'stubble', facialHairColor:'ashBlonde', facialHairSize:.9, outfit:'tee', outfitColor:'teal', hat:'none', bodyBuild:'slim', bodyHeight:1.08, bodyWidth:.91, personality:'none'}
    }
  };

  const ANIMATIONS = [
    ['idle','Idle','🙂'], ['look-left','Look left','👀'], ['look-right','Look right','👀'], ['wave','Wave','👋'], ['think','Think','🤔'], ['laugh','Laugh','😂'], ['shock','Shock','😲'], ['sad','Sad','😔'], ['cheer','Cheer','🙌'], ['point','Point','👉'], ['dance','Dance','🕺'], ['victory','Victory','🏆']
  ];

const clone=o=>JSON.parse(JSON.stringify(o));
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const title=v=>String(v).replace(/([A-Z])/g,' $1').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase()).trim();
const color=(k,v)=>COLORS[k][v]||v||'#333';
const facePath=s=>({round:'M120 72C88 72 68 96 69 139c1 42 22 68 51 71 29-3 50-29 51-71 1-43-19-67-51-67Z',oval:'M120 66C91 66 73 91 73 138s21 75 47 76c26-1 47-30 47-76s-18-72-47-72Z',long:'M120 62C94 62 78 88 78 137c0 53 18 84 42 85 25-1 42-32 42-85 0-49-16-75-42-75Z',square:'M91 76Q73 85 72 112l3 58q3 31 44 40 42-9 47-40l2-58q-1-27-20-36Z',softSquare:'M90 77q-17 13-17 39l3 53q4 30 43 40 39-10 45-40l3-53q0-26-17-39-30-11-60 0Z',heart:'M120 77C98 62 72 78 72 114c0 44 19 79 48 97 29-18 48-53 48-97 0-36-26-52-48-37Z',diamond:'M120 66c-24 1-44 25-46 61-1 38 17 76 46 89 29-13 47-51 46-89-2-36-22-60-46-61Z'}[s]||'M120 66C91 66 73 91 73 138s21 75 47 76c26-1 47-30 47-76s-18-72-47-72Z');
function ageSvg(d){if(d==='none')return'';const a='<path fill="none" stroke="#9D6D5A" stroke-opacity=".34" stroke-width="1.6" stroke-linecap="round" ';const sm=a+'d="M91 159q-5 4-7 12m65-12q5 4 7 12"/>';const fr=a+'d="M98 98q22-7 44 0m-41 7q19-5 38 0"/>';return d==='smileLines'?sm:d==='forehead'?fr:sm+fr;}
function hairSvg(s,c,flip){const A=`fill="${c}" stroke="#19213A" stroke-width="2.8" stroke-linejoin="round"`;const p=d=>`<path ${A} d="${d}"/>`;const cir=(x,y,r=10)=>`<circle ${A} cx="${x}" cy="${y}" r="${r}"/>`;let z={none:'',buzz:p('M81 107Q84 69 120 67q37 2 41 39-17-18-40-18t-40 19Z'),crop:p('M79 109Q82 70 120 67q37 0 44 39-15-15-32-13-20-14-36 1-8 5-17 15Z'),spikyCrop:p('M78 111l8-29 10 9 8-24 10 17 12-23 7 21 18-13-3 22 16-5-3 24q-16-19-38-19-24-1-45 20Z'),sidepart:p('M77 112q2-40 40-47 34-3 47 31-19-14-38-13-16-13-35 5-7 10-14 24Z'),sweptUp:p('M78 112q1-34 18-42 7-17 20-6 12-19 22 3 16-9 20 16 7 4 6 23-19-18-38-18-23-6-42 24Z'),receding:p('M80 111q2-33 21-39 11 8 19 11 9-5 19-11 19 7 23 39-13-17-22-16-9-7-20-4-13-4-22 5-8 2-18 19Z'),waves:p('M74 119q-4-31 15-44 19-16 39-7 23-3 36 20 10 20 0 38-7-13-16-14-6-21-22-18-13-16-29 2-11 21-24 26Z'),bob:p('M75 111q2-40 43-45 43 2 48 45l-2 62q-8 14-19 7l1-64q-6-29-26-27-22-2-28 27l2 65q-12 7-18-8Z'),layeredBob:p('M74 113q0-38 42-47 43-1 51 42l-3 53-10 20-9-12-7 14-8-14-9 16-8-16-10 14-8-15-11 11-8-21Z'),pixie:p('M76 110q2-31 20-40l5-12 11 10 12-13 8 14 15-8-1 18q14 4 18 27-15-15-30-14-17-14-33 1-13 3-26 17Z'),long:p('M73 112q1-39 45-48 46 1 50 47v79q-13 12-19-6l-1-67q-5-30-28-29-24-1-29 29v68q-7 17-18 5Z'),lowPony:p('M75 112q1-40 43-47 42 2 48 45l-8 32q-6-16-11-29-5-27-27-25-23-1-29 28-5 14-9 27Z')+`<ellipse ${A} cx="167" cy="139" rx="15" ry="28"/>`+p('M166 158q19 16 10 38-13-4-19-25Z'),ponytail:p('M76 111q3-42 43-46 41 3 46 44-17-19-39-18-21-11-35 6-7 7-13 16Z')+`<ellipse ${A} cx="164" cy="97" rx="14" ry="21"/>`+p('M166 110q19 16 8 47-16-12-18-38Z'),bun:cir(145,62,23)+p('M76 111q3-41 43-46 41 2 46 43-16-18-39-17-21-10-35 6-7 7-13 17Z'),braid:p('M75 112q3-40 44-47 41 2 46 43-17-17-39-17-21-10-35 6-7 7-14 15Z')+p('M162 113q16 15 6 32 12 13 1 28 10 13-3 26-12-14-2-27-11-13-1-27-11-15 0-32Z')}[s];if(s==='shortCurls'||s==='tightCurls'||s==='shoulderCurls'){const pts=s==='shoulderCurls'?[[77,104],[83,84],[96,70],[114,65],[134,68],[150,78],[161,96],[164,116],[162,140],[159,162],[151,179],[88,180],[79,159],[76,136]]:[[77,105],[84,86],[97,72],[114,67],[132,69],[149,78],[160,94],[163,111],[153,121],[88,119]];z=pts.map(q=>cir(q[0],q[1],s==='tightCurls'?10:11)).join('');}if(flip&&z)z=`<g transform="translate(240 0) scale(-1 1)">${z}</g>`;return z||'';}
function browsSvg(a){const c=color('hair',a.browColor),y=116+a.browHeight,g=a.browSpacing,A=a.browAngle,sh={soft:'M-15 2Q0-3 15 2',straight:'M-15 0Q0-1 15 0',arched:'M-15 4Q0-8 15 4',thick:'M-16 3Q0-6 16 2',fine:'M-14 1Q0-4 14 1',raised:'M-15 3Q0-10 15 0'}[a.browStyle]||'M-15 2Q0-3 15 2',w=a.browStyle==='thick'?5:a.browStyle==='fine'?2.2:3.2;return`<g stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round">${piece(a,'leftBrow',`<path d="${sh}" transform="translate(${101-g/2} ${y}) rotate(${-A})"/>`,101-g/2,y)}${piece(a,'rightBrow',`<path d="${sh}" transform="translate(${139+g/2} ${y}) scale(-1 1) rotate(${-A})"/>`,139+g/2,y)}</g>`;}
function eyesSvg(a,e,pose=NEUTRAL_POSE,interactive=false){const c=color('eyes',a.eyeColor),d='#24293A',y=134+a.eyeHeight,g=18+a.eyeSpacing,s=a.eyeSize,t=a.eyeTilt;const one=(x,f)=>{const tr=`translate(${x} ${y}) rotate(${f?-t:t}) scale(${s})`;if(e==='laugh'||a.eyeStyle==='happy')return`<path d="M-9 2Q0-7 9 2" transform="${tr}" fill="none" stroke="${d}" stroke-width="3.3" stroke-linecap="round"/>`;if(e==='sad')return`<path d="M-9-2Q0 6 9-2" transform="${tr}" fill="none" stroke="${d}" stroke-width="3"/>`;if(e==='shock'||a.eyeStyle==='wide')return`<ellipse cx="${x}" cy="${y}" rx="8.2" ry="10" fill="#fff" stroke="${d}" stroke-width="2.2"/><circle cx="${x}" cy="${y+1}" r="4" fill="${c}"/><circle cx="${x}" cy="${y+1}" r="2" fill="${d}"/>`;const q={round:'<ellipse rx="7.8" ry="8.8"',almond:'<path d="M-10 0Q0-8 10 0Q0 8-10 0Z"',narrow:'<path d="M-10 1Q0-5 10 1Q0 6-10 1Z"',soft:'<path d="M-9 0Q0-7 9 0Q0 7-9 0Z"',lashes:'<path d="M-10 0Q0-8 10 0Q0 8-10 0Z"'}[a.eyeStyle]||'<path d="M-10 0Q0-8 10 0Q0 8-10 0Z"';return`<g transform="${tr}">${q} fill="#fff" stroke="${d}" stroke-width="2.1"/>${a.eyeStyle==='lashes'?`<path d="M7-5l5-4m-3 7 6-1" stroke="${d}" stroke-width="1.7"/>`:''}<circle cy="1" r="4" fill="${c}"/><circle cy="1" r="2.1" fill="${d}"/><circle cx="-1.4" cy="-.4" r=".9" fill="#fff"/></g>`};const blinkScale=Math.max(.08,1-pose.blink*.92),eye=(x,id,flip)=>piece(a,id,`${one(x,flip)}${interactive?`<circle data-puppet-handle="eyes" cx="${x}" cy="${y}" r="16" fill="transparent" stroke="transparent"/>`:''}`,x,y);return`<g class="eyes-group" data-puppet-joint="eyes" transform="translate(${pose.gazeX} ${pose.gazeY})"><g transform="translate(0 ${y}) scale(1 ${blinkScale}) translate(0 ${-y})">${eye(120-g,'leftEye')}${eye(120+g,'rightEye',1)}</g></g>`;}
function noseSvg(a){const y=153+a.noseHeight,s=a.noseSize,c='#9B6A56',p={dot:`<circle cx="120" cy="${y}" r="2.6" fill="${c}"/>`,small:`<path d="M120 ${y-5}q-4 8 0 10 4 0 6-2"`,round:`<path d="M120 ${y-6}q-7 9 0 12 7 1 10-3"`,straight:`<path d="M119 ${y-10}q-1 11 0 16 5 1 8-2"`,wide:`<path d="M120 ${y-6}q-5 7-1 11-8 0-10 4m12-4q8 0 10 4"`,long:`<path d="M118 ${y-12}q0 15-2 20 6 3 12-1"`,button:`<path d="M120 ${y-4}q-6 4-4 9 4 5 10 0 2-5-6-9"`}[a.noseStyle];return a.noseStyle==='dot'?p:`<g transform="translate(${120*(1-s)} ${y*(1-s)}) scale(${s})">${p||''} fill="none" stroke="${c}" stroke-width="2.1" stroke-linecap="round"/></g>`;}
function mouthSvg(a,e,pose=NEUTRAL_POSE,interactive=false){const y=177+a.mouthHeight,s=a.mouthWidth,c='#632F35',openScale=1+Math.max(-.65,pose.mouth)*.9;let markup='';if(e==='shock')markup=`<ellipse cx="120" cy="${y}" rx="8.2" ry="${8*openScale}" fill="${c}"/>`;else if(e==='sad'||pose.mouth<-.55)markup=`<path d="M104 ${y+5}Q120 ${y-7} 136 ${y+5}" fill="none" stroke="${c}" stroke-width="3.2"/>`;else if(e==='laugh'||pose.mouth>.68)markup=`<path d="M102 ${y-2}Q120 ${y+18*openScale} 138 ${y-2}Q120 ${y+6} 102 ${y-2}Z" fill="${c}"/>`;else {const m={smile:`<path d="M103 ${y-2}Q120 ${y+9} 137 ${y-2}"`,softSmile:`<path d="M106 ${y-1}Q120 ${y+7} 134 ${y-1}"`,thinSmile:`<path d="M107 ${y}Q120 ${y+5} 133 ${y}"`,toothy:`<path d="M102 ${y-3}Q120 ${y+13} 138 ${y-3}Q120 ${y+5} 102 ${y-3}Z" fill="#fff"`,wideSmile:`<path d="M99 ${y-4}Q120 ${y+16} 141 ${y-4}Q120 ${y+7} 99 ${y-4}Z" fill="#fff"`,smirk:`<path d="M106 ${y+1}Q123 ${y+7} 136 ${y-3}"`,open:`<ellipse cx="120" cy="${y+2}" rx="12" ry="${8*openScale}" fill="${c}"`,neutral:`<path d="M108 ${y}Q120 ${y+1} 132 ${y}"`}[a.mouthStyle]||'';const filled=/fill=/.test(m);markup=`<g transform="translate(${120*(1-s)} 0) scale(${s} 1)">${m} ${filled?'':`fill="none"`} stroke="${c}" stroke-width="${filled?2.2:3}" stroke-linecap="round"/></g>`;}return`<g data-puppet-joint="mouth" transform="translate(0 ${-pose.mouth*2})">${markup}${interactive?`<circle data-puppet-handle="mouth" cx="120" cy="${y}" r="14" fill="transparent" stroke="transparent"/>`:''}</g>`;}
function glassesSvg(a){if(a.glasses==='none')return'';const y=a.glassesHeight,s=a.glassesSize,c=a.signatureDetail==='blueFrames'?'#2E65A5':a.glassesColor==='brown'?'#5B4037':'#252A36',A=`fill="none" stroke="${c}" stroke-width="3"`,q={square:`<rect x="91" y="126" width="25" height="20" rx="4" ${A}/><rect x="124" y="126" width="25" height="20" rx="4" ${A}/>`,softSquare:`<rect x="91" y="126" width="25" height="20" rx="8" ${A}/><rect x="124" y="126" width="25" height="20" rx="8" ${A}/>`,round:`<circle cx="103" cy="136" r="12" ${A}/><circle cx="137" cy="136" r="12" ${A}/>`,catEye:`<path d="M89 131q14-9 28-3l-3 17q-16 3-23-7Z" ${A}/><path d="M151 131q-14-9-28-3l3 17q16 3 23-7Z" ${A}/>`,sunglasses:'<path d="M90 127q13-4 27 1l-3 18q-16 3-23-9Z" fill="#20242D"/><path d="M150 127q-13-4-27 1l3 18q16 3 23-9Z" fill="#20242D"/>'}[a.glasses];return`<g class="glasses-detail" transform="translate(${120*(1-s)} ${y}) scale(${s})">${q}<path d="M116 134q4-3 8 0" ${A}/></g>`;}
function facialHairSvg(a){if(a.facialHair==='none')return'';const c=color('hair',a.facialHairColor),s=a.facialHairSize,q={stubble:`<path d="M94 167q2 32 26 38 24-6 26-38-7 23-26 28-19-5-26-28Z" fill="${c}" opacity=".23"/>`,moustache:`<path d="M119 165q-11-6-19 3 10 3 20 0 10 3 20 0-8-9-19-3Z" fill="${c}"/>`,goatee:`<path d="M119 165q-11-6-19 3 10 3 20 0 10 3 20 0-8-9-19-3Z" fill="${c}"/><path d="M110 184q10 17 20 0-1 23-10 27-9-4-10-27Z" fill="${c}"/>`,shortBeard:`<path d="M91 161q1 35 29 47 28-12 29-47-8 26-29 34-21-8-29-34Z" fill="${c}"/>`,fullBeard:`<path d="M86 155q1 41 17 56l9 8 8-5 9 6 9-10q15-15 16-55-10 29-20 37l-8 9-7-3-7 4-10-11q-10-10-16-36Z" fill="${c}"/>`}[a.facialHair];return`<g class="beard-detail" transform="translate(${120*(1-s)} ${185*(1-s)}) scale(${s})">${q}</g>`;}
function extrasSvg(a){const x=a.extras||[];let z='';if(x.includes('freckles'))z+='<g fill="#A86752" opacity=".52"><circle cx="97" cy="149" r="1.3"/><circle cx="104" cy="152" r="1.3"/><circle cx="110" cy="149" r="1.3"/><circle cx="130" cy="149" r="1.3"/><circle cx="137" cy="152" r="1.3"/><circle cx="143" cy="149" r="1.3"/></g>';if(x.includes('earrings'))z+='<g fill="#D8B34A"><circle cx="73" cy="158" r="4"/><path d="M73 161l-3 8 3 4 3-4Z"/><circle cx="167" cy="158" r="4"/><path d="M167 161l-3 8 3 4 3-4Z"/></g>';if(x.includes('necklace'))z+='<path d="M103 233q17 14 34 0" fill="none" stroke="#C4B07B" stroke-width="2.4"/><circle cx="120" cy="244" r="3" fill="#C4B07B"/>';if(x.includes('choker'))z+='<path d="M102 229q18 8 36 0" fill="none" stroke="#252933" stroke-width="4"/>';if(x.includes('crossbody')){if(a.signatureDetail==='wovenStrap')z+='<path d="M90 220l57 90" stroke="#71814D" stroke-width="12"/><path d="M96 231l5 8m5 6 6 9m5 7 5 8m5 7 6 9" stroke="#E0B94A" stroke-width="4"/><rect x="136" y="282" width="25" height="30" rx="5" fill="#D5A52C"/>';else{const strap=['redCapMark','outdoorStrap'].includes(a.signatureDetail)?'#242832':'#57493F';z+=`<path d="M90 222l56 87" stroke="${strap}" stroke-width="10"/><rect x="135" y="282" width="25" height="30" rx="5" fill="#3B3636"/>`;}}if(a.signatureDetail==='starTattoos')z+='<g fill="#33404F" opacity=".72"><path d="M159 249l2 4 4 1-4 2-1 4-2-4-4-1 4-2Z"/><circle cx="164" cy="267" r="1.7"/><path d="M158 278l1.5 3 3.5.7-3 1.7-.5 3.5-1.7-3-3.5-.5 3-1.8Z"/></g>';return z;}
function hatSvg(a){const A='stroke="#1E2435" stroke-width="3"',q={none:'',blackCap:`<path d="M78 98q6-39 43-39 37 1 44 39-22-15-45-14-22-2-42 14Z" fill="#242832" ${A}/><path d="M119 88q26 0 47 9-16 7-42 2Z" fill="#1B1F29"/>`,grayCap:`<path d="M78 98q6-39 43-39 37 1 44 39-22-15-45-14-22-2-42 14Z" fill="#70747B" ${A}/><path d="M119 88q26 0 47 9-16 7-42 2Z" fill="#5A5E66"/>`,sunHat:`<ellipse cx="120" cy="89" rx="62" ry="17" fill="#D9CFB7" ${A}/><path d="M86 88q3-39 34-41 31 2 35 41Z" fill="#E5DCC8" ${A}/>`,bucketHat:`<path d="M85 92q5-35 35-37 30 2 35 37Z" fill="#B6AD92" ${A}/><path d="M82 91q38 13 76 0-3 12-38 15-35-3-38-15Z" fill="#A89F84"/>`,beanie:`<path d="M82 95q2-38 38-41 36 3 38 41Z" fill="#262E43" ${A}/><rect x="82" y="88" width="76" height="17" rx="7" fill="#30394F"/>`}[a.hat];let detail='';if(a.hat==='blackCap'&&a.signatureDetail==='capPatch')detail='<rect x="112" y="66" width="16" height="12" rx="2" fill="#B89E82" stroke="#1E2435" stroke-width="2"/><path d="M116 72h8" stroke="#6D5A49" stroke-width="2"/>';if(a.hat==='blackCap'&&a.signatureDetail==='redCapMark')detail='<path d="M106 72l8-5 5 4 6-4 9 5-6 2 4 5-10-2-5 4-2-6Z" fill="#E65050" stroke="#1E2435" stroke-width="1.5"/>';return`<g class="hat-detail">${piece(a,'hat',q||'',120,80)}${piece(a,'hatDecoration',detail,120,73)}</g>`;}
function signatureHeadSvg(a){if(a.signatureDetail!=='blueFrames')return'';const c=color('hair',a.hairColor);return`<path d="M87 105q10-19 22-9 7-14 18 1 9-9 24 8-13-6-22 4-10-10-18 1-10-9-24-5Z" fill="${c}" stroke="#19213A" stroke-width="2.4" stroke-linejoin="round"/>`;}
function jointedTorsoSvg(a){
  const c=color('outfit',a.outfitColor),ac=COLORS.accent[a.outfitAccent]||COLORS.outfit[a.outfitAccent]||'#D6A93A',A='stroke="#1B2236" stroke-width="3"';
  let base=`<path d="M101 220q19-8 38 0l8 102H93Z" fill="${c}" ${A}/>`;
  if(a.outfit==='plaid')base+=`<path d="M94 235h52m-54 20h55m-57 21h59M105 220v100m17-102v104m17-100v96" stroke="#172744" stroke-width="3" opacity=".7"/>`;
  if(a.outfit==='polo')base+=`<path d="M105 220l15 15 15-15" fill="none" stroke="#D8DCE8" stroke-width="4"/>`;
  if(a.outfit==='button')base+=`<path d="M120 219v100" stroke="#E7E7E7" stroke-opacity=".65" stroke-width="2"/>`;
  if(a.outfit==='openShirt')base+=`<path d="M103 220l10 31 7-19 7 19 10-31" fill="#E9D9B9"/><path d="M120 219v100" stroke="#E7E7E7" stroke-opacity=".65" stroke-width="2"/><path d="M95 249l8 4m34-4 8 4m-51 15 8 4m37-4 8 4" stroke="${ac}" stroke-width="3"/>`;
  if(a.outfit==='overshirt')base+=`<path d="M107 220h26l9 102h-44Z" fill="#F1F0EC"/><path d="M108 220l12 36 13-36m-13 36v67" fill="none" stroke="#1B2236" stroke-width="3"/><path d="M100 246h8m24 0h8" stroke="#D8DCE8" stroke-width="2"/>`;
  if(a.outfit==='suit')base+=`<path d="M103 219l17 33 17-33-8 31-9 14-9-14Z" fill="#F2F0EB"/><path d="M120 236l7 20-7 14-7-14Z" fill="${ac}"/>`;
  if(a.outfit==='hoodie')base+=`<path d="M101 221q19 21 38 0" fill="none" stroke="#20263A" stroke-width="5"/>`;
  return base;
}
function riggedGarment(a,id,markup,B,pivotY,decoration=false,armId=null,armPivotX=120,armPivotY=pivotY){const outfit=getPieceTransform(a,'outfit'),pattern=getPieceTransform(a,'outfitDecoration'),arm=armId?getPieceTransform(a,armId):null;return `<g data-avatar-garment-transform="${id}" transform="${pieceTransformAttribute(outfit,120,pivotY)}"${outfit.hidden?' visibility="hidden"':''}>${decoration?`<g data-avatar-garment-decoration-transform="${id}" transform="${pieceTransformAttribute(pattern,120,pivotY)}"${pattern.hidden?' visibility="hidden"':''}>`:''}${arm?`<g data-avatar-garment-arm-transform="${id}" transform="${pieceTransformAttribute(arm,armPivotX,armPivotY)}"${arm.hidden?' visibility="hidden"':''}>`:''}<g transform="${B}">${markup}</g>${arm?'</g>':''}${decoration?'</g>':''}</g>`;}
function tropicalTorsoPrint(){return '<g fill="none" stroke-linecap="round"><path d="M112 245q-7 9-3 18m4-14q7 7 4 16m10-19q7 9 3 18m-2-14q-7 7-4 16m-14 24q8 7 4 17m20-18q-8 8-4 18" stroke="#B9E5D7" stroke-width="3.5"/><path d="M109 255l-4-2m14 4 4-2m8 2 4-2m-31 40-5-2m29 4 5-2" stroke="#F2C46D" stroke-width="2.5"/></g>';}
function geometricTorsoPrint(){return '<g fill="none" stroke-linejoin="round"><path d="M96 242l24 17 24-17" stroke="#F3F0E8" stroke-width="6"/><path d="M96 260l24 22 24-22" stroke="#1F2738" stroke-width="5"/><path d="M101 279l19 17 19-17" stroke="#B84E72" stroke-width="4"/></g>';}
function geometricSleevePrint(side,segment){const left=side==='left';const d=segment==='upper'?(left?'M78 244l9 7 9-7':'M162 244l-9 7-9-7'):(left?'M77 280l7 6 7-6':'M163 280l-7 6-7-6');return `<g data-avatar-sleeve-pattern="${side}-${segment}" fill="none" stroke-linejoin="round"><path d="${d}" stroke="#F3F0E8" stroke-width="4"/><path d="${left?'M78 292l7 6 7-6':'M162 292l-7 6-7-6'}" stroke="#B84E72" stroke-width="3"/></g>`;}function tropicalSleevePrint(side,segment){const upper=segment==='upper';const d=side==='left'?(upper?'M81 239q-7 7-4 15m5-12q6 6 3 14':'M77 279q8 6 4 15m7-13q-6 7-3 15'):(upper?'M159 239q7 7 4 15m-5-12q-6 6-3 14':'M163 279q-8 6-4 15m-7-13q6 7 3 15');return `<g data-avatar-sleeve-pattern="${side}-${segment}" fill="none" stroke-linecap="round"><path d="${d}" stroke="#B9E5D7" stroke-width="3.5"/><path d="${side==='left'?'M80 247l-4-2m11 4 4-2':'M160 247l4-2m-11 4-4-2'}" stroke="#F2C46D" stroke-width="2.5"/></g>`;}function outfitSvg(a){let decoration='';const c=color('outfit',a.outfitColor),ac=COLORS.accent[a.outfitAccent]||COLORS.outfit[a.outfitAccent]||'#D6A93A',A='stroke="#1B2236" stroke-width="3"';let base=`<path d="M86 227q15-11 34-11t34 11l11 62-19 11-8-53 1 75h-38l1-75-8 53-19-11Z" fill="${c}" ${A}/>`;if(a.outfit==='tank')base=`<path d="M99 220q21-8 42 0l8 102H91Z" fill="${c}" ${A}/><path d="M104 219q16 14 32 0" fill="none" stroke="#1B2236" stroke-width="3"/>`;if(a.outfit==='floral'){const flowers=a.signatureDetail==='sunsetFlorals'?'<g><circle cx="99" cy="239" r="5" fill="#F15B64"/><circle cx="112" cy="249" r="4" fill="#46DBDC"/><circle cx="132" cy="241" r="5" fill="#7367F0"/><circle cx="141" cy="261" r="4" fill="#F2C94C"/><circle cx="101" cy="275" r="5" fill="#4C78C6"/><circle cx="122" cy="287" r="4" fill="#F15B64"/><circle cx="140" cy="302" r="5" fill="#46DBDC"/><path d="M93 253q12 8 18 20m12-29q-6 13-2 31m10-6q-8 9-9 24" fill="none" stroke="#263F79" stroke-width="3"/></g>':`<g fill="${ac}"><circle cx="100" cy="240" r="5"/><circle cx="130" cy="254" r="5"/><circle cx="108" cy="280" r="5"/><circle cx="136" cy="298" r="5"/></g>`;base=`<path d="M92 220q28-8 56 0l5 102H87Z" fill="${c}" ${A}/>${a.signatureDetail==='sunsetFlorals'?'':flowers}`;if(a.signatureDetail==='sunsetFlorals')decoration=flowers;}if(a.outfit==='dress')base=`<path d="M93 220q27-10 54 0l4 36 15 66H74l15-66Z" fill="${c}" ${A}/>`;if(a.outfit==='overshirt')base=`<path d="M87 228q33-17 66 0l7 94H80Z" fill="${c}" ${A}/><path d="M107 220h26l9 102h-44Z" fill="#F1F0EC"/><path d="M87 228l22-8 11 36 11-36 22 8m-33 27v67" fill="none" stroke="#1B2236" stroke-width="3"/><path d="M91 246h13m32 0h13" stroke="#D8DCE8" stroke-width="2"/>`;if(a.outfit==='suit')base+=`<path d="M103 219l17 33 17-33-8 31-9 14-9-14Z" fill="#F2F0EB"/><path d="M120 236l7 20-7 14-7-14Z" fill="${ac}"/>`;if(a.outfit==='plaid')base+=`<path d="M90 235h60m-63 20h66m-69 21h72M102 220v100m20-102v104m19-100v96" stroke="#172744" stroke-width="3" opacity=".7"/>`;if(a.outfit==='polo')base+=`<path d="M105 220l15 15 15-15" fill="none" stroke="#D8DCE8" stroke-width="4"/>`;if(a.outfit==='button'||a.outfit==='openShirt')base+=`<path d="M120 219v100" stroke="#E7E7E7" stroke-opacity=".65" stroke-width="2"/>`;if(a.outfit==='openShirt')base+=`<path d="M103 220l10 31 7-19 7 19 10-31" fill="#E9D9B9"/><path d="M88 239l12 7m38-7 13 7m-61 12 11 7m37-7 13 7" stroke="${ac}" stroke-width="3"/>`;if(a.outfit==='openShirt'&&a.signatureDetail==='tropicalPrint')decoration+='<g fill="none" stroke-linecap="round"><path d="M94 237q-10 8-7 19m9-15q8 8 4 19m42-23q10 9 6 20m-8-14q-8 8-3 18m-39 17q12 8 5 23m36-25q-11 9-5 23" stroke="#B9E5D7" stroke-width="4"/><path d="M91 249l-5-2m14 3 6-3m36 2 6-3m-10 5-5-4m-32 42-7-3m39 3 7-4" stroke="#F2C46D" stroke-width="3"/></g>';if(a.outfit==='hoodie')base+=`<path d="M101 221q19 21 38 0" fill="none" stroke="#20263A" stroke-width="5"/>`;if(a.outfit==='vest')base+=`<path d="M86 232l14-13 6 103-24-12Zm68 0-14-13-6 103 24-12Z" fill="${c}" ${A}/>`;if(a.outfit==='pfd')base=`<path d="M89 222q31-12 62 0l6 95H83Z" fill="#242A34" ${A}/><path d="M87 231l18-12 6 94-25-8Zm66 0-18-12-6 94 25-8Z" fill="${c}"/><rect x="99" y="250" width="42" height="7" rx="3" fill="#1E232D"/><rect x="99" y="278" width="42" height="7" rx="3" fill="#1E232D"/>`;if(a.signatureDetail==='geometricTop')decoration+='<g fill="none" stroke-linejoin="round"><path d="M88 240l32 21 32-21" stroke="#F3F0E8" stroke-width="8"/><path d="M87 257l33 30 34-30" stroke="#1F2738" stroke-width="7"/><path d="M94 280l26 22 27-22" stroke="#B84E72" stroke-width="5"/><path d="M82 307h76" stroke="#F3F0E8" stroke-width="4"/></g>';return {base,decoration};}
// Keep per-piece transforms outside the inherited proportions and animation groups.
// Offsets therefore use the same canvas coordinates for every character.
function piece(a, id, markup, cx, cy) {
  if (!markup) return '';
  const t = getPieceTransform(a, id);
  return `<g data-avatar-piece="${id}"${a.editor && a.selectedPiece === id ? ' data-selected="true"' : ''} transform="${pieceTransformAttribute(t,cx,cy)}"${t.hidden ? ' visibility="hidden"' : ''}>${markup}</g>`;
}
function renderAvatar(v,o={}) {
  const a={...DEFAULT_AVATAR,...v,extras:[...(v.extras||[])],editor:o.editor,selectedPiece:o.selectedPiece};
  const photoFaceId = typeof a.photoFaceId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(a.photoFaceId) ? a.photoFaceId : null;
  const live=Object.prototype.hasOwnProperty.call(o,'pose'),pose=live?clampPose(o.pose):NEUTRAL_POSE;
  const e=o.expression||expressionFromAnimation(o.animation||'idle'),skin=color('skin',a.skin),hair=color('hair',a.hairColor);
  const build={slim:.9,average:1,broad:1.1}[a.bodyBuild]||1,sx=a.bodyWidth*build,sy=a.bodyHeight;
  const F=`translate(${120*(1-a.faceWidth)} ${138*(1-a.faceHeight)}) scale(${a.faceWidth} ${a.faceHeight})`;
  const B=`translate(${120*(1-sx)} ${321*(1-sy)}) scale(${sx} ${sy})`;
  const body=(id,markup,cx,cy)=>{if(!markup)return'';const pivotX=120+(cx-120)*sx,pivotY=321+(cy-321)*sy;if(id==='outfitDecoration'){const outfitT=getPieceTransform(a,'outfit'),decorationT=getPieceTransform(a,id);return `<g data-avatar-piece="${id}"${a.editor&&a.selectedPiece===id?' data-selected="true"':''} transform="${pieceTransformAttribute(outfitT,pivotX,pivotY)}"${outfitT.hidden?' visibility="hidden"':''}><g data-avatar-garment-decoration="torso" transform="${pieceTransformAttribute(decorationT,pivotX,pivotY)}"${decorationT.hidden?' visibility="hidden"':''}><g transform="${B}">${markup}</g></g></g>`;}return piece(a,id,`<g transform="${B}">${markup}</g>`,pivotX,pivotY);};
  const clothes=outfitSvg(a);const longSleeves=['button','openShirt','overshirt','plaid','suit','hoodie'].includes(a.outfit),hasSleeves=longSleeves||['tee','polo'].includes(a.outfit);if(hasSleeves)clothes.base=jointedTorsoSvg(a);if(a.outfit==='openShirt'&&a.signatureDetail==='tropicalPrint')clothes.decoration=tropicalTorsoPrint();if(hasSleeves&&a.signatureDetail==='geometricTop')clothes.decoration=geometricTorsoPrint();const sleeveLayer=(side,segment)=>{
    if(!hasSleeves||segment==='lower'&&!longSleeves)return'';
    const left=side==='left',c=color('outfit',a.outfitColor),A='stroke="#1B2236" stroke-width="2.8" stroke-linejoin="round"';
    const d=segment==='upper'?(left?'M88 226Q69 242 73 267L87 273 104 236Z':'M152 226Q171 242 167 267L153 273 136 236Z'):(left?'M73 263Q65 281 73 299L77 307Q86 307 85 296L89 271Z':'M167 263Q175 281 167 299L163 307Q154 307 155 296L151 271Z');
    const shoulder=left?91:149,elbow=left?78:162,pivotY=321+(269-321)*sy,armPivotX=120+((left?82:158)-120)*sx,armPivotY=321+(266-321)*sy,armId=side+'Arm';
    const joint=(markup)=>segment==='upper'?`<g data-puppet-joint="${side}-shoulder" transform="rotate(${pose[side+'Arm']} ${shoulder} 230)">${markup}</g>`:`<g data-puppet-joint="${side}-shoulder" transform="rotate(${pose[side+'Arm']} ${shoulder} 230)"><g data-puppet-joint="${side}-elbow" transform="rotate(${pose[side+'Elbow']} ${elbow} 267)">${markup}</g></g>`;
    const sleeve=`<g data-avatar-garment="${side}-${segment}-sleeve"><path d="${d}" fill="${c}" ${A}/></g>`;
    const baseLayer=riggedGarment(a,`${side}-${segment}-sleeve`,joint(sleeve),B,pivotY,false,armId,armPivotX,armPivotY);
    const patternMarkup=a.signatureDetail==='geometricTop'&&hasSleeves?geometricSleevePrint(side,segment):a.outfit==='openShirt'&&a.signatureDetail==='tropicalPrint'?tropicalSleevePrint(side,segment):'';
    if(!patternMarkup)return baseLayer;
    return baseLayer+riggedGarment(a,`${side}-${segment}-sleeve-pattern`,joint(patternMarkup),B,pivotY,true,armId,armPivotX,armPivotY);
  };const sleeveOverlays=['left','right'].flatMap(side=>[sleeveLayer(side,'upper'),sleeveLayer(side,'lower')]).join('');const tattooArmT=getPieceTransform(a,'rightArm');const tattooOverlay=a.signatureDetail==='starTattoos'?piece(a,'tattoos',`<g data-avatar-garment-arm-transform="tattoos" transform="${pieceTransformAttribute(tattooArmT,120+(158-120)*sx,321+(266-321)*sy)}"${tattooArmT.hidden?' visibility="hidden"':''}><g transform="${B}"><g data-puppet-joint="right-shoulder" transform="rotate(${pose.rightArm} 149 230)"><path d="M159 249l2 4 4 1-4 2-1 4-2-4-4-1 4-2Z" fill="#33404F" opacity=".72"/><g data-puppet-joint="right-elbow" transform="rotate(${pose.rightElbow} 162 267)"><circle cx="164" cy="267" r="1.7" fill="#33404F" opacity=".72"/><path d="M158 278l1.5 3 3.5.7-3 1.7-.5 3.5-1.7-3-3.5-.5 3-1.8Z" fill="#33404F" opacity=".72"/></g></g></g></g>`,120+(160-120)*sx,321+(266-321)*sy):'';
  const extra=(name)=>extrasSvg({...a,extras:[name],signatureDetail:a.signatureDetail==='starTattoos'?'none':a.signatureDetail});
  const earrings=extra('earrings');
  const earLeft=earrings ? `<g fill="#D8B34A">${earrings.slice(earrings.indexOf('<circle'),earrings.indexOf('<circle cx="167"'))}</g>` : '';
  const earRight=earrings ? `<g fill="#D8B34A">${earrings.slice(earrings.indexOf('<circle cx="167"'),earrings.lastIndexOf('</g>'))}</g>` : '';
  const handle=(name,x,y,r=12)=>o.interactive?`<circle data-puppet-handle="${name}" cx="${x}" cy="${y}" r="${r}" fill="transparent" stroke="transparent" stroke-width="2"/>`:'';
  const arm=(side)=>{
    const left=side==='left',upper=left?`<path d="M91 230Q74 246 78 267L88 272 101 236Z" fill="${skin}" stroke="#1B2236" stroke-width="2.8"/><g data-puppet-joint="left-elbow" transform="rotate(${pose.leftElbow} 78 267)"><path d="M73 263Q66 280 74 298L78 307Q86 307 84 296L88 272Z" fill="${skin}" stroke="#1B2236" stroke-width="2.8"/><circle class="puppet-fastener" cx="78" cy="267" r="3.3"/>${handle('leftHand',78,307,13)}</g>`:`<path d="M149 230Q166 246 162 267L152 272 139 236Z" fill="${skin}" stroke="#1B2236" stroke-width="2.8"/><g data-puppet-joint="right-elbow" transform="rotate(${pose.rightElbow} 162 267)"><path d="M167 263Q174 280 166 298L162 307Q154 307 156 296L152 272Z" fill="${skin}" stroke="#1B2236" stroke-width="2.8"/><circle class="puppet-fastener" cx="162" cy="267" r="3.3"/>${handle('rightHand',162,307,13)}</g>`;
    const px=left?91:149,py=230;
    return `<g data-puppet-joint="${side}-shoulder" transform="rotate(${pose[side+'Arm']} ${px} ${py})">${upper}<circle class="puppet-fastener" cx="${px}" cy="${py}" r="3.7"/></g>`;
  };
  const leg=(side)=>{
    const left=side==='left',hip=left?104:136;
    const upper=left?`<path d="M96 308h16l-3 37-12 2Z" fill="#222A3A" stroke="#151C2D" stroke-width="2.5"/><g data-puppet-joint="left-knee" transform="rotate(${pose.leftKnee} 103 346)"><path d="M98 346h10v13l-2 8h-7l-3-8Z" fill="#222A3A" stroke="#151C2D" stroke-width="2.5"/><path d="M98 362q-9 5-12 9 0 5 9 3l15-4-2-8Z" fill="#222A3A" stroke="#151C2D" stroke-width="2.5"/><circle class="puppet-fastener" cx="103" cy="346" r="3"/>${handle('leftFoot',94,369,13)}</g>`:`<path d="M128 308h16l3 37-12 2Z" fill="#222A3A" stroke="#151C2D" stroke-width="2.5"/><g data-puppet-joint="right-knee" transform="rotate(${pose.rightKnee} 137 346)"><path d="M132 346h10l2 13-3 8h-7l-2-8Z" fill="#222A3A" stroke="#151C2D" stroke-width="2.5"/><path d="M142 362q9 5 12 9 0 5-9 3l-15-4 2-8Z" fill="#222A3A" stroke="#151C2D" stroke-width="2.5"/><circle class="puppet-fastener" cx="137" cy="346" r="3"/>${handle('rightFoot',146,369,13)}</g>`;
    return `<g data-puppet-joint="${side}-hip" transform="rotate(${pose[side+'Leg']} ${hip} 307)">${upper}</g>`;
  };
  return `<svg class="avatar-svg anim-${esc(live?'live':o.animation||'idle')} personality-${esc(a.personality||'none')}" viewBox="0 0 240 390" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.label||'King Prompter avatar')}"><g class="puppet"${live?' data-live-pose="true"':''}>
    <ellipse cx="120" cy="357" rx="48" ry="8" fill="#07102A" opacity=".3"/>
    <g data-puppet-frame="body" transform="translate(${pose.x} ${pose.y}) rotate(${pose.body} 120 275)">
    ${body('leftLeg',`<g class="leg-left" data-puppet-joint="left-leg">${leg('left')}</g>`,100,334)}
    ${body('rightLeg',`<g class="leg-right" data-puppet-joint="right-leg">${leg('right')}</g>`,140,334)}
    ${body('leftArm',`<g class="arm-left" data-puppet-joint="left-arm">${arm('left')}</g>`,82,266)}
    ${body('rightArm',`<g class="arm-right" data-puppet-joint="right-arm">${arm('right')}</g>`,158,266)}
    ${body('outfit',clothes.base,120,269)}${body('outfitDecoration',clothes.decoration,120,269)}${tattooOverlay}${sleeveOverlays}
    ${a.extras.includes('necklace')?body('necklace',extra('necklace'),120,238):''}
    ${a.extras.includes('crossbody')?body('crossbody',extra('crossbody'),126,268):''}


    <g class="head-group" data-puppet-frame="head" data-puppet-joint="head" transform="rotate(${pose.head} 120 138)">
      ${photoFaceId ? piece(a,'face', `<image data-photo-face="true" href="/api/profile/face/${photoFaceId}" x="48" y="48" width="144" height="168" preserveAspectRatio="xMidYMax meet"/>`, 120, 138) : `
      ${piece(a,'leftEar',`<ellipse cx="74" cy="139" rx="8" ry="13" fill="${skin}"/>`,74,139)}
      ${piece(a,'rightEar',`<ellipse cx="166" cy="139" rx="8" ry="13" fill="${skin}"/>`,166,139)}
      ${piece(a,'face',`<g transform="${F}"><path d="${facePath(a.faceShape)}" fill="${skin}" stroke="#1B2236" stroke-width="3"/></g>`,120,138)}
      ${piece(a,'faceDetail',ageSvg(a.ageDetail),120,138)}
      ${a.hairStyle!=='none'?piece(a,'hair',`<g class="hair-detail" transform="translate(0 ${a.hairline})">${hairSvg(a.hairStyle,hair,a.hairFlip)}</g>`,120,100+a.hairline):''}
      ${piece(a,'fringe',signatureHeadSvg(a),120,103)}
      ${browsSvg(a)}${eyesSvg(a,e,pose,Boolean(o.interactive))}
      ${piece(a,'nose',noseSvg(a),120,153+a.noseHeight)}
      ${piece(a,'mouth',mouthSvg(a,e,pose,Boolean(o.interactive)),120,177+a.mouthHeight)}
      ${piece(a,'facialHair',facialHairSvg(a),120,185)}
      ${piece(a,'glasses',glassesSvg(a),120,136*a.glassesSize+a.glassesHeight)}
      ${a.extras.includes('freckles')?piece(a,'freckles',extra('freckles'),120,150):''}
      ${a.extras.includes('choker')?piece(a,'choker',extra('choker'),120,232):''}${a.extras.includes('earrings')?piece(a,'leftEarring',earLeft,73,163)+piece(a,'rightEarring',earRight,167,163):''}
      ${hatSvg(a)}`}
    ${handle('head',120,138,34)}</g>${handle('body',120,268,24)}</g></g></svg>`;
}
function expressionFromAnimation(a){return a==='laugh'?'laugh':a==='shock'?'shock':a==='sad'?'sad':'normal'}

export { COLORS, OPTIONS, FEATURE_CATEGORIES, DEFAULT_AVATAR, FAMILY_PRESETS, ANIMATIONS, clone, title, renderAvatar };
