// Player roles: Entry, Lurker, AWPer, Anchor, Closer
// Each team has exactly one of each role

export type PlayerRole = "Entry" | "Lurker" | "AWPer" | "Anchor" | "IGL" | "Coach";

export const playerRoles: Record<string, PlayerRole> = {
  // Team Falcons
  blameF: "Anchor",
  TeSeS: "Lurker",
  ZywOo: "AWPer",
  apEX: "IGL",
  kyxsan: "Entry",

  // Windigo
  bubble: "IGL",
  nukkye: "Lurker",
  ArtFr0sT: "Anchor",
  dem0n: "Entry",
  sh1ro: "AWPer",

  // GalactiC
  firaXi: "Anchor",
  TaReX: "AWPer",
  svaipZ: "Entry",
  PlesseN: "IGL",
  EliGE: "Lurker",

  // AVANGAR
  SANJI: "IGL",
  bl3nd: "Lurker",
  MazloV: "Entry",
  zont1x: "Anchor",
  VolTage: "AWPer",

  // Vitality
  hantZ: "AWPer",
  JACKZ: "IGL",
  mezii: "Anchor",
  ropz: "Lurker",
  AcilioN: "Entry",

  // LT Twisted Minds
  ToKsin: "Lurker",
  EspiranTo: "IGL",
  SanTeliS: "Entry",
  jL: "Anchor",
  Horus: "AWPer",

  // FunPlus Phoenix
  xms: "Entry",
  to1nou: "Anchor",
  myez: "Lurker",
  Lucky: "IGL",
  Kursy: "AWPer",

  // FURIA
  molodoy: "AWPer",
  arT: "Entry",
  KSCERATO: "Anchor",
  yuurih: "Lurker",
  FalleN: "IGL",

  // Team Liquid
  NAF: "Anchor",
  Twistzz: "IGL",
  YEKINDAR: "Entry",
  maden: "Lurker",
  ultimate: "AWPer",

  // The MongolZ
  dazLoco: "AWPer",
  Mzinho: "Lurker",
  Senzu: "Entry",
  Techno4k: "Anchor",
  bLitz: "IGL",

  // Vision Gaming
  nats: "Lurker",
  dennis: "IGL",
  draken: "Anchor",
  KeZi: "Entry",
  RusTy: "AWPer",

  // FaZe Clan
  SunPayus: "AWPer",
  frozen: "Entry",
  NiKo: "IGL",
  AcreoN: "Lurker",
  iM: "Anchor",

  // Movistar Riders
  MuTiRiS: "IGL",
  loWel: "Anchor",
  dav1g: "Lurker",
  cadmo: "AWPer",
  iNSTiNCT: "Entry",

  // NRG eSports
  CeRq: "AWPer",
  nitr0: "Anchor",
  Xyp9x: "IGL",
  ottoNd: "Lurker",
  KmZ: "Entry",

  // North
  exxon: "Lurker",
  cadiaN: "AWPer",
  HUNDEN: "Entry",
  Magisk: "IGL",
  nicoodoz: "Anchor",

  // Sprout
  dantamax: "AWPer",
  iSt3s: "Entry",
  Spiidi: "IGL",
  teNzki: "Anchor",
  Tr1xie: "Lurker",

  // Grayhound
  malta: "Lurker",
  Fairlii: "Entry",
  angeL: "AWPer",
  INS: "IGL",
  satoshi: "Anchor",

  // Team Spirit
  donk: "Entry",
  iDISBALANCE: "Anchor",
  FL1T: "Lurker",
  chopper: "IGL",
  m0NESY: "AWPer",

  // MVP Project
  xcurrate: "AWPer",
  jBk: "Anchor",
  henox: "Lurker",
  derkos: "IGL",
  XigN: "Entry",

  // Complexity
  elemeNt: "AWPer",
  sjuush: "IGL",
  aproTo: "Lurker",
  oBo: "Anchor",
  NikkeZ: "Entry",

  // MOUZ
  kRYSTAL: "Anchor",
  syrsoN: "AWPer",
  Spinx: "Lurker",
  huNter: "IGL",
  REZ: "Entry",

  // Astralis
  jabbi: "Entry",
  dev1ce: "AWPer",
  v4lde: "Lurker",
  Snappi: "Anchor",
  HooXi: "IGL",

  // Bravado Gaming
  Bizzy: "IGL",
  bLiZzard: "Entry",
  arkiN: "Lurker",
  MisteM: "Anchor",
  EleTrick: "AWPer",

  // OG eSports
  mantuu: "AWPer",
  hutji: "Lurker",
  SHiPZ: "Entry",
  es3tag: "Anchor",
  dexter: "IGL",

  // VOX Eminor
  dither: "Anchor",
  scarra: "Lurker",
  proSeN: "Entry",
  f1nest: "IGL",
  Gratisfaction: "AWPer",

  // Eternal Fire
  MAJ3R: "IGL",
  Wicadia: "Lurker",
  Calyx: "Anchor",
  XANTARES: "Entry",
  w0xic: "AWPer",

  // Natus Vincere
  b1t: "Lurker",
  poizon: "AWPer",
  Makazze: "Anchor",
  electronic: "IGL",
  malbsMd: "Entry",

  // Astana Dragons
  KrizzeN: "Entry",
  qikert: "IGL",
  griff: "Lurker",
  frontales: "AWPer",
  neaLaN: "Anchor",

  // ENCE
  Aleksib: "IGL",
  allu: "AWPer",
  Kaaymos: "Entry",
  xseveN: "Lurker",
  LETN1: "Anchor",

  // Ijsberen eSports
  sefa: "Entry",
  PCK: "Anchor",
  MissK8: "Lurker",
  ElStaK: "IGL",
  ZykloN: "AWPer",

  // FlyQuest
  liazz: "Lurker",
  jks: "Entry",
  AZR: "Anchor",
  USTILO: "IGL",
  Nifty: "AWPer",

  // Amkal
  hypr: "IGL",
  v1tal: "Lurker",
  keshandr: "Anchor",
  gr1ks: "AWPer",
  kyousuke: "Entry",

  // Pollen Tantrum
  xertz: "Entry",
  RaZ: "Anchor",
  aslan: "Lurker",
  sterling: "IGL",
  nebet: "AWPer",

  // Parivision
  sdy: "IGL",
  "KaiR0N-": "Entry",
  Neityu: "Lurker",
  torzsi: "AWPer",
  Magnojez: "Anchor",

  // x6tence galaxy
  coRoZz: "Entry",
  spyder: "Anchor",
  shimari: "Lurker",
  Polen: "IGL",
  LoReN: "AWPer",

  // NiP
  hampus: "Anchor",
  Lekr0: "Lurker",
  ZyTre: "AWPer",
  KRIMZ: "IGL",
  Benzn: "Entry",

  // Inner Circle
  saveey: "Entry",
  jR: "IGL",
  NEOFRAG: "Anchor",
  jank0: "IGL",
  stressarN: "Lurker",

  // IHC eSports
  kabal: "Entry",
  sk0r: "Anchor",
  ANNIHILA: "Lurker",
  hasteka: "IGL",
  "910": "AWPer",

  // Splyce
  zOOt: "Entry",
  deficit: "AWPer",
  Kila: "Lurker",
  primaL: "Anchor",
  RFX: "IGL",

  // 3Dmax
  VirreN: "Entry",
  Ex3rcice: "Lurker",
  ryL: "Anchor",
  TrusT: "AWPer",
  Graviti: "IGL",

  // Entropiq
  MariX: "Anchor",
  syco: "Lurker",
  h0bbit: "IGL",
  Krimbo: "Entry",
  MaXi: "AWPer",

  // paiN Gaming
  felps: "Entry",
  cerdaN: "Lurker",
  biguzera: "IGL",
  snow: "Anchor",
  abone: "AWPer",

  // Sinister5
  scheeR: "Entry",
  Chappy: "IGL",
  ruben: "Lurker",
  godspeed: "Anchor",
  tr1ton: "AWPer",

  // Gamers2
  xeta: "Anchor",
  iKo: "Entry",
  ryuk: "Lurker",
  poL1tz: "AWPer",
  DD: "IGL",

  // Keyd Stars
  t9rnay: "Anchor",
  abr: "IGL",
  brnz4n: "Lurker",
  insani: "Entry",
  kye: "AWPer",

  // Ancient
  shroud: "Lurker",
  aykeN: "AWPer",
  DeadFox: "Entry",
  jasonR: "Anchor",
  craen: "IGL",

  // Syman Gaming
  erkaSt: "IGL",
  MagnumZ: "Lurker",
  lucid: "AWPer",
  cool4st: "Anchor",
  laxiee: "Entry",

  // KRU eSports
  Noktse: "Entry",
  yeL: "AWPer",
  meyern: "Lurker",
  kriT: "Anchor",
  kinho: "IGL",

  // Game Agents
  kolor: "Entry",
  ngiN: "AWPer",
  eLiVe: "Lurker",
  Zero: "Anchor",
  paz: "IGL",

  // Rogue
  SkerZ: "Entry",
  playn: "AWPer",
  double: "Lurker",
  quaKe: "Anchor",
  xprt: "IGL",

  // ATK
  mendo: "Entry",
  vice: "AWPer",
  yukar: "Lurker",
  Pot1on: "Anchor",
  pOp: "IGL",

  // Apeks
  jkaem: "Entry",
  hallzerk: "AWPer",
  isak: "Lurker",
  crusaDe: "Anchor",
  Xander: "IGL",

  // Renegades
  vexite: "Entry",
  cam1x: "Lurker",
  xsepower: "AWPer",
  nettik: "Anchor",
  oSee: "IGL",

  // Evil Geniuses
  skyhe: "Entry",
  zanz: "AWPer",
  st1ch: "Lurker",
  JDC: "Anchor",
  zyoN: "IGL",

  // Dream Eaters
  addicT: "Entry",
  s1mke: "AWPer",
  FASHR: "Lurker",
  PakG: "Anchor",
  vince: "IGL",

  // Got200 Gaming
  vanisch: "Entry",
  Qwickshel: "AWPer",
  davy: "Lurker",
  lynX: "Anchor",
  flame: "IGL",

  // 9ine
  KEi: "Entry",
  Demho: "AWPer",
  KMX: "Lurker",
  Prism: "Anchor",
  hades: "IGL",

  // Valhalla
  diaXuuN: "Entry",
  HUNDZi: "AWPer",
  EdezeNNN: "Lurker",
  em3radic: "Anchor",
  Bjarni: "IGL",

  // Legacy
  dumau: "Entry",
  latto: "AWPer",
  saadziN: "Lurker",
  danoCo: "Anchor",
  lux: "IGL",

  // Space Soldiers
  DESPE: "Entry",
  imoRR: "AWPer",
  TuGuX: "Lurker",
  EMSTAR: "Anchor",
  hardstyle: "IGL",

  // Cr4zy
  Woro2k: "Entry",
  DemQQ: "AWPer",
  rain: "IGL",
  ISSAA: "Lurker",
  stanislaw: "Anchor",

  // Heroic
  Alkaren: "Anchor",
  tn1R: "AWPer",
  stavn: "Entry",
  aizy: "Lurker",
  LNZ: "IGL",

  // Portal
  HSB: "Entry",
  traNz: "AWPer",
  PokemoN: "Lurker",
  Yaqob: "Anchor",
  StoraX: "IGL",

  // Bad News Eagles
  SENER1: "Entry",
  "gxx-": "AWPer",
  Krabeni: "Lurker",
  sinopsyy: "Anchor",
  rigoN: "IGL",

  // Quantum Bellator
  x1ron: "Entry",
  kasya: "AWPer",
  saRRafi: "Lurker",
  raizo: "Anchor",
  pa1nkiller: "IGL",

  // BIG
  "gob b": "Anchor",
  keev: "AWPer",
  xfl0ud: "Entry",
  hippo: "Lurker",
  k1to: "IGL",

  // Imperial
  boltz: "Entry",
  VINI: "Lurker",
  chelo: "AWPer",
  skullz: "Anchor",
  zakk: "IGL",

  // fnatic
  Brollan: "Entry",
  Xizt: "Anchor",
  kyuubii: "AWPer",
  modurist: "Lurker",
  sheddaN: "IGL",

  // 9z Team
  dgt: "Entry",
  max: "AWPer",
  dav1deuS: "Lurker",
  buda: "Anchor",
  try: "IGL",

  // Team Immunity
  bURNRUOk: "Entry",
  MoeycQ: "AWPer",
  james: "Lurker",
  MAGIKKK: "Anchor",
  gazR: "IGL",

  // Marsborne
  GriZz: "Entry",
  gonzo: "AWPer",
  ToraTTi: "Lurker",
  Pengu1n: "Anchor",
  mst: "IGL",

  // GODSENT
  eXpeL: "Entry",
  zehN: "AWPer",
  pr1metapz: "Lurker",
  stan: "Anchor",
  polaroid: "IGL",

  // GamerLegion
  ztr: "Entry",
  PR: "AWPer",
  faveN: "Lurker",
  MATYS: "Anchor",
  hypex: "IGL",

  // M80
  wonder: "Entry",
  maNkz: "AWPer",
  dazzLe: "Lurker",
  Lake: "Anchor",
  reck: "IGL",

  // Penta Sports
  awzek: "Entry",
  s1n: "AWPer",
  PANIX: "Lurker",
  innocent: "Anchor",
  hyped: "IGL",

  // Wildcard
  JBa: "Entry",
  Swisher: "AWPer",
  br0: "Lurker",
  XotiC: "Anchor",
  nicx: "IGL",

  // Vexed Gaming
  coSbo: "Entry",
  AciDiC: "AWPer",
  redge0: "Lurker",
  RitZy: "Anchor",
  depthSpider: "IGL",

  // TyLoo
  Moseyuh: "Entry",
  BnTeT: "AWPer",
  fancy: "Lurker",
  JamYoung: "Anchor",
  Jee: "IGL",

  // Epsilon eSports
  NaqeLi: "Entry",
  maka: "AWPer",
  mKadin: "Lurker",
  antika: "Anchor",
  Creo: "IGL",

  // Nexus
  arc: "Entry",
  regali: "AWPer",
  lauNX: "Lurker",
  kavenTo: "Anchor",
  ZetioN: "IGL",

  // Betclic Apogee
  TaZ: "Anchor",
  hfah: "AWPer",
  jcobbb: "Entry",
  Kylar: "Lurker",
  Melavi: "IGL",

  // Nemiga
  Jyo: "Entry",
  Frynaut: "AWPer",
  botez: "Lurker",
  boX: "Anchor",
  evire: "IGL",

  // OpTic Gaming
  JUGi: "AWPer",
  gade: "Entry",
  jdm64: "Lurker",
  Skadoodle: "Anchor",
  FreakZ: "IGL",

  // Lazarus eSports
  FNS: "Anchor",
  Subroza: "Lurker",
  yay: "AWPer",
  infinite: "Entry",
  wardell: "IGL",

  // NoLimit Gaming
  s4nzy: "Entry",
  GaXe: "AWPer",
  rasmus: "Lurker",
  basiq: "Anchor",
  toggler: "IGL",

  // Endpoint
  spektra: "Entry",
  jeLLo: "AWPer",
  sl3nd: "Lurker",
  KanOx: "Anchor",
  CRUC1AL: "IGL",

  // Parallax
  Hatz: "Entry",
  Lonsdale: "AWPer",
  yellow: "Lurker",
  sico: "Anchor",
  kyoto: "IGL",

  // Astra Vendetta
  kaarT: "Entry",
  filian: "AWPer",
  "5erene5": "Lurker",
  SkarmaT: "Anchor",
  leveni: "IGL",

  // Fluxo
  v$m: "Entry",
  astera: "AWPer",
  PuFFy: "Lurker",
  chuti: "Anchor",
  Spamzzy: "IGL",

  // Third Impact
  RZU: "Entry",
  grape: "AWPer",
  DaneJoris: "Lurker",
  mont4na: "Anchor",
  xCeeD: "IGL",

  // Mythic
  fl0m: "AWPer",
  hate: "Entry",
  cooper: "Lurker",
  freakazoid: "Anchor",
  cxzi: "IGL",

  // FUT eSports
  eclyon: "Entry",
  SparkZ: "AWPer",
  kriMp: "Lurker",
  v1caR: "Anchor",
  Xaka: "IGL",

  // Renevant eSports
  "3nable": "Entry",
  argenT: "AWPer",
  fluckZ: "Lurker",
  GFi: "Anchor",
  kaZe: "IGL",

  // 9Pandas
  r3salt: "Entry",
  d1Ledez: "AWPer",
  zhoKing: "Lurker",
  Krad: "Anchor",
  s1kura: "IGL",

  // Tengri
  SNk: "Entry",
  ProjeksT: "AWPer",
  Ramz1k: "Lurker",
  enzero: "Anchor",
  yaqK: "IGL",

  // Rare Atom
  nJta: "Entry",
  baLi: "AWPer",
  enlai: "Lurker",
  kaito: "Anchor",
  abiLo: "IGL",

  // ZIGMA
  RoLEX: "Entry",
  NIFFY: "AWPer",
  GeniusSs: "Lurker",
  j9: "Anchor",
  hxskxth: "IGL",

  // Lynn Vision
  EmiliaQaQ: "Entry",
  Su3: "AWPer",
  z4kr: "Lurker",
  Starry: "Anchor",
  westmelon: "IGL",

  // InSilio
  sugaR: "Entry",
  t0rick: "AWPer",
  veslaR: "Lurker",
  tokuzo: "Anchor",
  zanxxX: "IGL",

  // Sharks
  chay: "Entry",
  drg: "AWPer",
  Gafolo: "Lurker",
  rdnzao: "Anchor",
  n1ssim: "IGL",
};

// Role display helpers
export const roleColors: Record<PlayerRole, string> = {
  Entry: "bg-red-500/20 text-red-400 border-red-500/30",
  Lurker: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  AWPer: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Anchor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IGL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Coach: "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

export const roleIcons: Record<PlayerRole, string> = {
  Entry: "⚔️",
  Lurker: "👁️",
  AWPer: "🎯",
  Anchor: "🛡️",
  IGL: "🧠",
  Coach: "🎓",
};
