// Player roles: Entry, Lurker, AWPer, Anchor, Closer
// Each team has exactly one of each role

export type PlayerRole = "Entry" | "Lurker" | "AWPer" | "Anchor" | "IGL";

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
  mezii: "Entry",
  ropz: "Lurker",
  AcilioN: "Anchor",

  // LT Twisted Minds
  ToKsin: "Anchor",
  EspiranTo: "IGL",
  SanTeliS: "Entry",
  jL: "Lurker",
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
  KSCERATO: "Lurker",
  yuurih: "Anchor",
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
  dennis: "Entry",
  draken: "AWPer",
  KeZi: "Anchor",
  RusTy: "IGL",

  // FaZe Clan
  SunPayus: "AWPer",
  frozen: "IGL",
  NiKo: "Entry",
  AcreoN: "Anchor",
  iM: "Lurker",

  // Movistar Riders
  MuTiRiS: "Anchor",
  loWel: "Entry",
  dav1g: "AWPer",
  cadmo: "Lurker",
  iNSTiNCT: "IGL",

  // NRG eSports
  CeRq: "AWPer",
  nitr0: "Anchor",
  Xyp9x: "IGL",
  ottoNd: "Lurker",
  KmZ: "Entry",

  // North
  exxon: "Entry",
  cadiaN: "AWPer",
  HUNDEN: "Lurker",
  Magisk: "Anchor",
  nicoodoz: "IGL",

  // Sprout
  dantamax: "Entry",
  iSt3s: "AWPer",
  Spiidi: "Lurker",
  teNzki: "Anchor",
  Tr1xie: "IGL",

  // Grayhound
  malta: "Entry",
  Fairlii: "Lurker",
  angeL: "Anchor",
  INS: "AWPer",
  satoshi: "IGL",

  // Team Spirit
  donk: "Entry",
  iDISBALANCE: "Anchor",
  FL1T: "Lurker",
  chopper: "IGL",
  m0NESY: "AWPer",

  // MVP Project
  xcurrate: "Entry",
  jBk: "AWPer",
  henox: "Lurker",
  derkos: "Anchor",
  XigN: "IGL",

  // Complexity
  elemeNt: "Entry",
  sjuush: "Lurker",
  aproTo: "AWPer",
  oBo: "IGL",
  NikkeZ: "Anchor",

  // MOUZ
  kRYSTAL: "Anchor",
  syrsoN: "AWPer",
  Spinx: "Entry",
  huNter: "IGL",
  REZ: "Lurker",

  // Astralis
  jabbi: "Entry",
  dev1ce: "AWPer",
  v4lde: "Lurker",
  Snappi: "Anchor",
  HooXi: "IGL",

  // Bravado Gaming
  Bizzy: "Entry",
  bLiZzard: "AWPer",
  arkiN: "Lurker",
  MisteM: "Anchor",
  EleTrick: "IGL",

  // OG eSports
  mantuu: "AWPer",
  hutji: "Lurker",
  SHiPZ: "Entry",
  es3tag: "Anchor",
  dexter: "IGL",

  // VOX Eminor
  dither: "Entry",
  scarra: "Lurker",
  proSeN: "AWPer",
  f1nest: "Anchor",
  Gratisfaction: "IGL",

  // Eternal Fire
  MAJ3R: "Anchor",
  Wicadia: "AWPer",
  Calyx: "Entry",
  XANTARES: "IGL",
  w0xic: "Lurker",

  // Natus Vincere
  b1t: "Entry",
  poizon: "AWPer",
  Makazze: "Lurker",
  electronic: "IGL",
  malbsMd: "Anchor",

  // Astana Dragons
  KrizzeN: "Entry",
  qikert: "IGL",
  griff: "AWPer",
  frontales: "Lurker",
  neaLaN: "Anchor",

  // ENCE
  Aleksib: "Anchor",
  allu: "AWPer",
  Kaaymos: "Entry",
  xseveN: "Lurker",
  LETN1: "IGL",

  // Ijsberen eSports
  sefa: "Entry",
  PCK: "AWPer",
  MissK8: "Lurker",
  ElStaK: "Anchor",
  ZykloN: "IGL",

  // FlyQuest
  liazz: "Lurker",
  jks: "IGL",
  AZR: "Anchor",
  USTILO: "Entry",
  Nifty: "AWPer",

  // Amkal
  hypr: "Entry",
  v1tal: "AWPer",
  keshandr: "Lurker",
  gr1ks: "Anchor",
  kyousuke: "IGL",

  // Pollen Tantrum
  xertz: "Entry",
  RaZ: "AWPer",
  aslan: "Lurker",
  sterling: "Anchor",
  nebet: "IGL",

  // Parivision
  sdy: "Entry",
  "KaiR0N-": "AWPer",
  Neityu: "Lurker",
  torzsi: "Anchor",
  Magnojez: "IGL",

  // x6tence galaxy
  coRoZz: "Entry",
  spyder: "AWPer",
  shimari: "Lurker",
  Polen: "Anchor",
  LoReN: "IGL",

  // NiP
  hampus: "Anchor",
  Lekr0: "Lurker",
  ZyTre: "AWPer",
  KRIMZ: "IGL",
  Benzn: "Entry",

  // Inner Circle
  saveey: "Entry",
  jR: "AWPer",
  NEOFRAG: "IGL",
  jank0: "Lurker",
  stressarN: "Anchor",

  // IHC eSports
  kabal: "Entry",
  sk0r: "AWPer",
  ANNIHILA: "Lurker",
  hasteka: "Anchor",
  "910": "IGL",

  // Splyce
  zOOt: "Entry",
  deficit: "AWPer",
  Kila: "Lurker",
  primaL: "Anchor",
  RFX: "IGL",

  // 3Dmax
  VirreN: "Entry",
  Ex3rcice: "Lurker",
  ryL: "AWPer",
  TrusT: "Anchor",
  Graviti: "IGL",

  // Entropiq
  MariX: "Entry",
  syco: "Lurker",
  h0bbit: "Anchor",
  Krimbo: "AWPer",
  MaXi: "IGL",

  // paiN Gaming
  felps: "Entry",
  cerdaN: "Lurker",
  biguzera: "AWPer",
  snow: "Anchor",
  abone: "IGL",

  // Sinister5
  scheeR: "Entry",
  Chappy: "AWPer",
  ruben: "Lurker",
  godspeed: "Anchor",
  tr1ton: "IGL",

  // Gamers2
  xeta: "Anchor",
  iKo: "Entry",
  ryuk: "AWPer",
  poL1tz: "Lurker",
  DD: "IGL",

  // Keyd Stars
  t9rnay: "Entry",
  abr: "AWPer",
  brnz4n: "Lurker",
  insani: "Anchor",
  kye: "IGL",

  // Ancient
  shroud: "Lurker",
  aykeN: "AWPer",
  DeadFox: "Entry",
  jasonR: "Anchor",
  craen: "IGL",

  // Syman Gaming
  erkaSt: "Entry",
  MagnumZ: "AWPer",
  lucid: "Lurker",
  cool4st: "Anchor",
  laxiee: "IGL",

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
};

export const roleIcons: Record<PlayerRole, string> = {
  Entry: "⚔️",
  Lurker: "👁️",
  AWPer: "🎯",
  Anchor: "🛡️",
  IGL: "🧠",
};
