// Player roles: Entry, Lurker, AWPer, Anchor, Closer
// Each team has exactly one of each role

export type PlayerRole = "Entry" | "Lurker" | "AWPer" | "Anchor" | "Closer";

export const playerRoles: Record<string, PlayerRole> = {
  // Team Falcons
  "blameF": "Anchor",
  "TeSeS": "Lurker",
  "ZywOo": "AWPer",
  "apEX": "Entry",
  "kyxsan": "Closer",

  // Windigo
  "bubble": "Entry",
  "nukkye": "Closer",
  "ArtFr0sT": "Lurker",
  "dem0n": "Anchor",
  "sh1ro": "AWPer",

  // GalactiC
  "firaXi": "Entry",
  "TaReX": "Lurker",
  "svaipZ": "Anchor",
  "PlesseN": "Closer",
  "EliGE": "AWPer",

  // AVANGAR
  "SANJI": "Lurker",
  "bl3nd": "Entry",
  "MazloV": "AWPer",
  "zont1x": "Anchor",
  "VolTage": "Closer",

  // Vitality
  "hantZ": "Entry",
  "JACKZ": "Anchor",
  "mezii": "Lurker",
  "ropz": "Closer",
  "AcilioN": "AWPer",

  // LT Twisted Minds
  "ToKsin": "Entry",
  "EspiranTo": "Closer",
  "SanTeliS": "Anchor",
  "jL": "AWPer",
  "Horus": "Lurker",

  // FunPlus Phoenix
  "xms": "Entry",
  "to1nou": "AWPer",
  "myez": "Lurker",
  "Lucky": "Closer",
  "Kursy": "Anchor",

  // FURIA
  "molodoy": "Lurker",
  "arT": "Entry",
  "KSCERATO": "Closer",
  "yuurih": "Anchor",
  "FalleN": "AWPer",

  // Team Liquid
  "NAF": "Anchor",
  "Twistzz": "Closer",
  "YEKINDAR": "Entry",
  "maden": "Lurker",
  "ultimate": "AWPer",

  // The MongolZ
  "dazLoco": "Entry",
  "Mzinho": "AWPer",
  "Senzu": "Lurker",
  "Techno4k": "Anchor",
  "bLitz": "Closer",

  // Vision Gaming
  "nats": "Lurker",
  "dennis": "Entry",
  "draken": "AWPer",
  "KeZi": "Anchor",
  "RusTy": "Closer",

  // FaZe Clan
  "SunPayus": "AWPer",
  "frozen": "Closer",
  "NiKo": "Entry",
  "AcreoN": "Anchor",
  "iM": "Lurker",

  // Movistar Riders
  "MuTiRiS": "Anchor",
  "loWel": "Entry",
  "dav1g": "AWPer",
  "cadmo": "Lurker",
  "iNSTiNCT": "Closer",

  // NRG eSports
  "CeRq": "AWPer",
  "nitr0": "Anchor",
  "Xyp9x": "Closer",
  "ottoNd": "Lurker",
  "KmZ": "Entry",

  // North
  "exxon": "Entry",
  "cadiaN": "AWPer",
  "HUNDEN": "Lurker",
  "Magisk": "Anchor",
  "nicoodoz": "Closer",

  // Sprout
  "dantamax": "Entry",
  "iSt3s": "AWPer",
  "Spiidi": "Lurker",
  "teNzki": "Anchor",
  "Tr1xie": "Closer",

  // Grayhound
  "malta": "Entry",
  "Fairlii": "Lurker",
  "angeL": "Anchor",
  "INS": "AWPer",
  "satoshi": "Closer",

  // Team Spirit
  "donk": "Entry",
  "iDISBALANCE": "Anchor",
  "FL1T": "Lurker",
  "chopper": "Closer",
  "m0NESY": "AWPer",

  // MVP Project
  "xcurrate": "Entry",
  "jBk": "AWPer",
  "henox": "Lurker",
  "derkos": "Anchor",
  "XigN": "Closer",

  // Complexity
  "elemeNt": "Entry",
  "sjuush": "Lurker",
  "aproTo": "AWPer",
  "oBo": "Closer",
  "NikkeZ": "Anchor",

  // MOUZ
  "kRYSTAL": "Anchor",
  "syrsoN": "AWPer",
  "Spinx": "Entry",
  "huNter": "Closer",
  "REZ": "Lurker",

  // Astralis
  "jabbi": "Entry",
  "dev1ce": "AWPer",
  "v4lde": "Lurker",
  "Snappi": "Anchor",
  "HooXi": "Closer",

  // Bravado Gaming
  "Bizzy": "Entry",
  "bLiZzard": "AWPer",
  "arkiN": "Lurker",
  "MisteM": "Anchor",
  "EleTrick": "Closer",

  // OG eSports
  "mantuu": "AWPer",
  "hutji": "Lurker",
  "SHiPZ": "Entry",
  "es3tag": "Anchor",
  "dexter": "Closer",

  // VOX Eminor
  "dither": "Entry",
  "scarra": "Lurker",
  "proSeN": "AWPer",
  "f1nest": "Anchor",
  "Gratisfaction": "Closer",

  // Eternal Fire
  "MAJ3R": "Anchor",
  "Wicadia": "AWPer",
  "Calyx": "Entry",
  "XANTARES": "Closer",
  "w0xic": "Lurker",

  // Natus Vincere
  "b1t": "Entry",
  "poizon": "AWPer",
  "Makazze": "Lurker",
  "electronic": "Closer",
  "malbsMd": "Anchor",

  // Astana Dragons
  "KrizzeN": "Entry",
  "qikert": "Closer",
  "griff": "AWPer",
  "frontales": "Lurker",
  "neaLaN": "Anchor",

  // ENCE
  "Aleksib": "Anchor",
  "allu": "AWPer",
  "Kaaymos": "Entry",
  "xseveN": "Lurker",
  "LETN1": "Closer",

  // Ijsberen eSports
  "sefa": "Entry",
  "PCK": "AWPer",
  "MissK8": "Lurker",
  "ElStaK": "Anchor",
  "ZykloN": "Closer",

  // FlyQuest
  "liazz": "Lurker",
  "jks": "Closer",
  "AZR": "Anchor",
  "USTILO": "Entry",
  "Nifty": "AWPer",

  // Amkal
  "hypr": "Entry",
  "v1tal": "AWPer",
  "keshandr": "Lurker",
  "gr1ks": "Anchor",
  "kyousuke": "Closer",

  // Pollen Tantrum
  "xertz": "Entry",
  "RaZ": "AWPer",
  "aslan": "Lurker",
  "sterling": "Anchor",
  "nebet": "Closer",

  // Parivision
  "sdy": "Entry",
  "KaiR0N-": "AWPer",
  "Neityu": "Lurker",
  "torzsi": "Anchor",
  "Magnojez": "Closer",

  // x6tence galaxy
  "coRoZz": "Entry",
  "spyder": "AWPer",
  "shimari": "Lurker",
  "Polen": "Anchor",
  "LoReN": "Closer",

  // NiP
  "hampus": "Anchor",
  "Lekr0": "Lurker",
  "ZyTre": "AWPer",
  "KRIMZ": "Closer",
  "Benzn": "Entry",

  // Inner Circle
  "saveey": "Entry",
  "jR": "AWPer",
  "NEOFRAG": "Closer",
  "jank0": "Lurker",
  "stressarN": "Anchor",

  // IHC eSports
  "kabal": "Entry",
  "sk0r": "AWPer",
  "ANNIHILA": "Lurker",
  "hasteka": "Anchor",
  "910": "Closer",

  // Splyce
  "zOOt": "Entry",
  "deficit": "AWPer",
  "Kila": "Lurker",
  "primaL": "Anchor",
  "RFX": "Closer",

  // 3Dmax
  "VirreN": "Entry",
  "Ex3rcice": "Lurker",
  "ryL": "AWPer",
  "TrusT": "Anchor",
  "Graviti": "Closer",

  // Entropiq
  "MariX": "Entry",
  "syco": "Lurker",
  "h0bbit": "Anchor",
  "Krimbo": "AWPer",
  "MaXi": "Closer",

  // paiN Gaming
  "felps": "Entry",
  "cerdaN": "Lurker",
  "biguzera": "AWPer",
  "snow": "Anchor",
  "abone": "Closer",

  // Sinister5
  "scheeR": "Entry",
  "Chappy": "AWPer",
  "ruben": "Lurker",
  "godspeed": "Anchor",
  "tr1ton": "Closer",

  // Gamers2
  "xeta": "Anchor",
  "iKo": "Entry",
  "ryuk": "AWPer",
  "poL1tz": "Lurker",
  "DD": "Closer",

  // Keyd Stars
  "t9rnay": "Entry",
  "abr": "AWPer",
  "brnz4n": "Lurker",
  "insani": "Anchor",
  "kye": "Closer",

  // Ancient
  "shroud": "Lurker",
  "aykeN": "AWPer",
  "DeadFox": "Entry",
  "jasonR": "Anchor",
  "craen": "Closer",

  // Syman Gaming
  "erkaSt": "Entry",
  "MagnumZ": "AWPer",
  "lucid": "Lurker",
  "cool4st": "Anchor",
  "laxiee": "Closer",

  // KRU eSports
  "Noktse": "Entry",
  "yeL": "AWPer",
  "meyern": "Lurker",
  "kriT": "Anchor",
  "kinho": "Closer",

  // Game Agents
  "kolor": "Entry",
  "ngiN": "AWPer",
  "eLiVe": "Lurker",
  "Zero": "Anchor",
  "paz": "Closer",

  // Rogue
  "SkerZ": "Entry",
  "playn": "AWPer",
  "double": "Lurker",
  "quaKe": "Anchor",
  "xprt": "Closer",

  // ATK
  "mendo": "Entry",
  "vice": "AWPer",
  "yukar": "Lurker",
  "Pot1on": "Anchor",
  "pOp": "Closer",

  // Apeks
  "jkaem": "Entry",
  "hallzerk": "AWPer",
  "isak": "Lurker",
  "crusaDe": "Anchor",
  "Xander": "Closer",

  // Renegades
  "vexite": "Entry",
  "cam1x": "Lurker",
  "xsepower": "AWPer",
  "nettik": "Anchor",
  "oSee": "Closer",

  // Evil Geniuses
  "skyhe": "Entry",
  "zanz": "AWPer",
  "st1ch": "Lurker",
  "JDC": "Anchor",
  "zyoN": "Closer",

  // Dream Eaters
  "addicT": "Entry",
  "s1mke": "AWPer",
  "FASHR": "Lurker",
  "PakG": "Anchor",
  "vince": "Closer",

  // Got200 Gaming
  "vanisch": "Entry",
  "Qwickshel": "AWPer",
  "davy": "Lurker",
  "lynX": "Anchor",
  "flame": "Closer",

  // 9ine
  "KEi": "Entry",
  "Demho": "AWPer",
  "KMX": "Lurker",
  "Prism": "Anchor",
  "hades": "Closer",

  // Valhalla
  "diaXuuN": "Entry",
  "HUNDZi": "AWPer",
  "EdezeNNN": "Lurker",
  "em3radic": "Anchor",
  "Bjarni": "Closer",

  // Legacy
  "dumau": "Entry",
  "latto": "AWPer",
  "saadziN": "Lurker",
  "danoCo": "Anchor",
  "lux": "Closer",

  // Space Soldiers
  "DESPE": "Entry",
  "imoRR": "AWPer",
  "TuGuX": "Lurker",
  "EMSTAR": "Anchor",
  "hardstyle": "Closer",

  // Cr4zy
  "Woro2k": "Entry",
  "DemQQ": "AWPer",
  "rain": "Closer",
  "ISSAA": "Lurker",
  "stanislaw": "Anchor",

  // Heroic
  "Alkaren": "Anchor",
  "tn1R": "AWPer",
  "stavn": "Entry",
  "aizy": "Lurker",
  "LNZ": "Closer",

  // Portal
  "HSB": "Entry",
  "traNz": "AWPer",
  "PokemoN": "Lurker",
  "Yaqob": "Anchor",
  "StoraX": "Closer",

  // Bad News Eagles
  "SENER1": "Entry",
  "gxx-": "AWPer",
  "Krabeni": "Lurker",
  "sinopsyy": "Anchor",
  "rigoN": "Closer",

  // Quantum Bellator
  "x1ron": "Entry",
  "kasya": "AWPer",
  "saRRafi": "Lurker",
  "raizo": "Anchor",
  "pa1nkiller": "Closer",

  // BIG
  "gob b": "Anchor",
  "keev": "AWPer",
  "xfl0ud": "Entry",
  "hippo": "Lurker",
  "k1to": "Closer",

  // Imperial
  "boltz": "Entry",
  "VINI": "Lurker",
  "chelo": "AWPer",
  "skullz": "Anchor",
  "zakk": "Closer",

  // fnatic
  "Brollan": "Entry",
  "Xizt": "Anchor",
  "kyuubii": "AWPer",
  "modurist": "Lurker",
  "sheddaN": "Closer",

  // 9z Team
  "dgt": "Entry",
  "max": "AWPer",
  "dav1deuS": "Lurker",
  "buda": "Anchor",
  "try": "Closer",

  // Team Immunity
  "bURNRUOk": "Entry",
  "MoeycQ": "AWPer",
  "james": "Lurker",
  "MAGIKKK": "Anchor",
  "gazR": "Closer",

  // Marsborne
  "GriZz": "Entry",
  "gonzo": "AWPer",
  "ToraTTi": "Lurker",
  "Pengu1n": "Anchor",
  "mst": "Closer",

  // GODSENT
  "eXpeL": "Entry",
  "zehN": "AWPer",
  "pr1metapz": "Lurker",
  "stan": "Anchor",
  "polaroid": "Closer",

  // GamerLegion
  "ztr": "Entry",
  "PR": "AWPer",
  "faveN": "Lurker",
  "MATYS": "Anchor",
  "hypex": "Closer",

  // M80
  "wonder": "Entry",
  "maNkz": "AWPer",
  "dazzLe": "Lurker",
  "Lake": "Anchor",
  "reck": "Closer",

  // Penta Sports
  "awzek": "Entry",
  "s1n": "AWPer",
  "PANIX": "Lurker",
  "innocent": "Anchor",
  "hyped": "Closer",

  // Wildcard
  "JBa": "Entry",
  "Swisher": "AWPer",
  "br0": "Lurker",
  "XotiC": "Anchor",
  "nicx": "Closer",

  // Vexed Gaming
  "coSbo": "Entry",
  "AciDiC": "AWPer",
  "redge0": "Lurker",
  "RitZy": "Anchor",
  "depthSpider": "Closer",

  // TyLoo
  "Moseyuh": "Entry",
  "BnTeT": "AWPer",
  "fancy": "Lurker",
  "JamYoung": "Anchor",
  "Jee": "Closer",

  // Epsilon eSports
  "NaqeLi": "Entry",
  "maka": "AWPer",
  "mKadin": "Lurker",
  "antika": "Anchor",
  "Creo": "Closer",

  // Nexus
  "arc": "Entry",
  "regali": "AWPer",
  "lauNX": "Lurker",
  "kavenTo": "Anchor",
  "ZetioN": "Closer",

  // Betclic Apogee
  "TaZ": "Anchor",
  "hfah": "AWPer",
  "jcobbb": "Entry",
  "Kylar": "Lurker",
  "Melavi": "Closer",

  // Nemiga
  "Jyo": "Entry",
  "Frynaut": "AWPer",
  "botez": "Lurker",
  "boX": "Anchor",
  "evire": "Closer",

  // OpTic Gaming
  "JUGi": "AWPer",
  "gade": "Entry",
  "jdm64": "Lurker",
  "Skadoodle": "Anchor",
  "FreakZ": "Closer",

  // Lazarus eSports
  "FNS": "Anchor",
  "Subroza": "Lurker",
  "yay": "AWPer",
  "infinite": "Entry",
  "wardell": "Closer",

  // NoLimit Gaming
  "s4nzy": "Entry",
  "GaXe": "AWPer",
  "rasmus": "Lurker",
  "basiq": "Anchor",
  "toggler": "Closer",

  // Endpoint
  "spektra": "Entry",
  "jeLLo": "AWPer",
  "sl3nd": "Lurker",
  "KanOx": "Anchor",
  "CRUC1AL": "Closer",

  // Parallax
  "Hatz": "Entry",
  "Lonsdale": "AWPer",
  "yellow": "Lurker",
  "sico": "Anchor",
  "kyoto": "Closer",

  // Astra Vendetta
  "kaarT": "Entry",
  "filian": "AWPer",
  "5erene5": "Lurker",
  "SkarmaT": "Anchor",
  "leveni": "Closer",

  // Fluxo
  "v$m": "Entry",
  "astera": "AWPer",
  "PuFFy": "Lurker",
  "chuti": "Anchor",
  "Spamzzy": "Closer",

  // Third Impact
  "RZU": "Entry",
  "grape": "AWPer",
  "DaneJoris": "Lurker",
  "mont4na": "Anchor",
  "xCeeD": "Closer",

  // Mythic
  "fl0m": "AWPer",
  "hate": "Entry",
  "cooper": "Lurker",
  "freakazoid": "Anchor",
  "cxzi": "Closer",

  // FUT eSports
  "eclyon": "Entry",
  "SparkZ": "AWPer",
  "kriMp": "Lurker",
  "v1caR": "Anchor",
  "Xaka": "Closer",

  // Renevant eSports
  "3nable": "Entry",
  "argenT": "AWPer",
  "fluckZ": "Lurker",
  "GFi": "Anchor",
  "kaZe": "Closer",

  // 9Pandas
  "r3salt": "Entry",
  "d1Ledez": "AWPer",
  "zhoKing": "Lurker",
  "Krad": "Anchor",
  "s1kura": "Closer",

  // Tengri
  "SNk": "Entry",
  "ProjeksT": "AWPer",
  "Ramz1k": "Lurker",
  "enzero": "Anchor",
  "yaqK": "Closer",

  // Rare Atom
  "nJta": "Entry",
  "baLi": "AWPer",
  "enlai": "Lurker",
  "kaito": "Anchor",
  "abiLo": "Closer",

  // ZIGMA
  "RoLEX": "Entry",
  "NIFFY": "AWPer",
  "GeniusSs": "Lurker",
  "j9": "Anchor",
  "hxskxth": "Closer",

  // Lynn Vision
  "EmiliaQaQ": "Entry",
  "Su3": "AWPer",
  "z4kr": "Lurker",
  "Starry": "Anchor",
  "westmelon": "Closer",

  // InSilio
  "sugaR": "Entry",
  "t0rick": "AWPer",
  "veslaR": "Lurker",
  "tokuzo": "Anchor",
  "zanxxX": "Closer",

  // Sharks
  "chay": "Entry",
  "drg": "AWPer",
  "Gafolo": "Lurker",
  "rdnzao": "Anchor",
  "n1ssim": "Closer",
};

// Role display helpers
export const roleColors: Record<PlayerRole, string> = {
  "Entry": "bg-red-500/20 text-red-400 border-red-500/30",
  "Lurker": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "AWPer": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Anchor": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Closer": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export const roleIcons: Record<PlayerRole, string> = {
  "Entry": "⚔️",
  "Lurker": "👁️",
  "AWPer": "🎯",
  "Anchor": "🛡️",
  "Closer": "💀",
};
