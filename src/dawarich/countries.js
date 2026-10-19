// -----------------------------------------------------------------------------
// Country names in the language of the integration. Dawarich names countries
// in English with their ISO 3166-1 alpha-3 code; Intl.DisplayNames (full ICU,
// shipped with Node) translates alpha-2 codes. The table below maps one to the
// other, taken from the `countries` table of Dawarich 1.16 (Natural Earth
// borders, public domain).
// -----------------------------------------------------------------------------

const PAIRS = [
  'ABWAW AFGAF AGOAO AIAAI ALAAX ALBAL ANDAD AREAE ARGAR ARMAM ASMAS ATAAQ ATFTF ATGAG AUSAU',
  'AUTAT AZEAZ BDIBI BELBE BENBJ BFABF BGDBD BGRBG BHRBH BHSBS BIHBA BLMBL BLRBY BLZBZ BMUBM',
  'BOLBO BRABR BRBBB BRNBN BTNBT BWABW CAFCF CANCA CHECH CHLCL CHNCN CIVCI CMRCM CODCD COGCG',
  'COKCK COLCO COMKM CPVCV CRICR CUBCU CUWCW CYMKY CYPCY CZECZ DEUDE DJIDJ DMADM DNKDK DOMDO',
  'DZADZ ECUEC EGYEG ERIER ESHEH ESPES ESTEE ETHET FINFI FJIFJ FLKFK FRAFR FROFO FSMFM GABGA',
  'GBRGB GEOGE GGYGG GHAGH GIBGI GINGN GMBGM GNBGW GNQGQ GRCGR GRDGD GRLGL GTMGT GUMGU GUYGY',
  'HKGHK HMDHM HNDHN HRVHR HTIHT HUNHU IDNID IMNIM INDIN IOTIO IRLIE IRNIR IRQIQ ISLIS ISRIL',
  'ITAIT JAMJM JEYJE JORJO JPNJP KAZKZ KENKE KGZKG KHMKH KIRKI KNAKN KORKR KWTKW LAOLA LBNLB',
  'LBRLR LBYLY LCALC LIELI LKALK LSOLS LTULT LUXLU LVALV MACMO MAFMF MARMA MCOMC MDAMD MDGMG',
  'MDVMV MEXMX MHLMH MKDMK MLIML MLTMT MMRMM MNEME MNGMN MNPMP MOZMZ MRTMR MSRMS MUSMU MWIMW',
  'MYSMY NAMNA NCLNC NERNE NFKNF NGANG NICNI NIUNU NLDNL NORNO NPLNP NRUNR NZLNZ OMNOM PAKPK',
  'PANPA PCNPN PERPE PHLPH PLWPW PNGPG POLPL PRIPR PRKKP PRTPT PRYPY PSEPS PYFPF QATQA ROURO',
  'RUSRU RWARW SAUSA SDNSD SENSN SGPSG SGSGS SHNSH SLBSB SLESL SLVSV SMRSM SOMSO SPMPM SRBRS',
  'SSDSS STPST SURSR SVKSK SVNSI SWESE SWZSZ SXMSX SYCSC SYRSY TCATC TCDTD TGOTG THATH TJKTJ',
  'TKMTM TLSTL TONTO TTOTT TUNTN TURTR TUVTV TWNTW TZATZ UGAUG UKRUA UMIUM URYUY USAUS UZBUZ',
  'VATVA VCTVC VENVE VGBVG VIRVI VNMVN VUTVU WLFWF WSMWS YEMYE ZAFZA ZMBZM ZWEZW',
]
  .join(' ')
  .split(' ');

const ALPHA2 = new Map(PAIRS.map((pair) => [pair.slice(0, 3), pair.slice(3)]));
const displayNames = new Map();

/**
 * @param {{ code: string, name: string }} country as Dawarich gives it
 * @param {string} language en, fr, de or es
 */
export function countryName(country, language) {
  const alpha2 = ALPHA2.get(country.code);
  if (alpha2) {
    try {
      if (!displayNames.has(language)) {
        displayNames.set(language, new Intl.DisplayNames([language], { type: 'region' }));
      }
      const name = displayNames.get(language).of(alpha2);
      if (name && name !== alpha2) {
        return name;
      }
    } catch {
      // no ICU data for this language: the English name of Dawarich
    }
  }
  return country.name || country.code;
}
