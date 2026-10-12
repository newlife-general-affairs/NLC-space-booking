
import { useState, useEffect } from 'react';
import en_US from 'antd/lib/locale/en_US.js';
const ar_EG = () => import('antd/lib/locale/ar_EG.js');
const az_AZ = () => import('antd/lib/locale/az_AZ.js');
const bg_BG = () => import('antd/lib/locale/bg_BG.js');
const bn_BD = () => import('antd/lib/locale/bn_BD.js');
const by_BY = () => import('antd/lib/locale/by_BY.js');
const ca_ES = () => import('antd/lib/locale/ca_ES.js');
const cs_CZ = () => import('antd/lib/locale/cs_CZ.js');
const da_DK = () => import('antd/lib/locale/da_DK.js');
const de_DE = () => import('antd/lib/locale/de_DE.js');
//const default = () => import ('antd/lib/locale/default.js');
const el_GR = () => import('antd/lib/locale/el_GR.js');
const en_GB = () => import('antd/lib/locale/en_GB.js');
const es_ES = () => import('antd/lib/locale/es_ES.js');
const et_EE = () => import('antd/lib/locale/et_EE.js');
const fa_IR = () => import('antd/lib/locale/fa_IR.js');
const fi_FI = () => import('antd/lib/locale/fi_FI.js');
const fr_BE = () => import('antd/lib/locale/fr_BE.js');
const fr_CA = () => import('antd/lib/locale/fr_CA.js');
const fr_FR = () => import('antd/lib/locale/fr_FR.js');
const ga_IE = () => import('antd/lib/locale/ga_IE.js');
const gl_ES = () => import('antd/lib/locale/gl_ES.js');
const he_IL = () => import('antd/lib/locale/he_IL.js');
const hi_IN = () => import('antd/lib/locale/hi_IN.js');
const hr_HR = () => import('antd/lib/locale/hr_HR.js');
const hu_HU = () => import('antd/lib/locale/hu_HU.js');
const hy_AM = () => import('antd/lib/locale/hy_AM.js');
const id_ID = () => import('antd/lib/locale/id_ID.js');
const is_IS = () => import('antd/lib/locale/is_IS.js');
const it_IT = () => import('antd/lib/locale/it_IT.js');
const ja_JP = () => import('antd/lib/locale/ja_JP.js');
const ka_GE = () => import('antd/lib/locale/ka_GE.js');
const kk_KZ = () => import('antd/lib/locale/kk_KZ.js');
const km_KH = () => import('antd/lib/locale/km_KH.js');
const kmr_IQ = () => import('antd/lib/locale/kmr_IQ.js');
const kn_IN = () => import('antd/lib/locale/kn_IN.js');
const ko_KR = () => import('antd/lib/locale/ko_KR.js');
const ku_IQ = () => import('antd/lib/locale/ku_IQ.js');
const lt_LT = () => import('antd/lib/locale/lt_LT.js');
const lv_LV = () => import('antd/lib/locale/lv_LV.js');
const mk_MK = () => import('antd/lib/locale/mk_MK.js');
const ml_IN = () => import('antd/lib/locale/ml_IN.js');
const mn_MN = () => import('antd/lib/locale/mn_MN.js');
const ms_MY = () => import('antd/lib/locale/ms_MY.js');
const nb_NO = () => import('antd/lib/locale/nb_NO.js');
const ne_NP = () => import('antd/lib/locale/ne_NP.js');
const nl_BE = () => import('antd/lib/locale/nl_BE.js');
const nl_NL = () => import('antd/lib/locale/nl_NL.js');
const pl_PL = () => import('antd/lib/locale/pl_PL.js');
const pt_BR = () => import('antd/lib/locale/pt_BR.js');
const pt_PT = () => import('antd/lib/locale/pt_PT.js');
const ro_RO = () => import('antd/lib/locale/ro_RO.js');
const ru_RU = () => import('antd/lib/locale/ru_RU.js');
const sk_SK = () => import('antd/lib/locale/sk_SK.js');
const sl_SI = () => import('antd/lib/locale/sl_SI.js');
const sr_RS = () => import('antd/lib/locale/sr_RS.js');
const sv_SE = () => import('antd/lib/locale/sv_SE.js');
const ta_IN = () => import('antd/lib/locale/ta_IN.js');
const th_TH = () => import('antd/lib/locale/th_TH.js');
const tr_TR = () => import('antd/lib/locale/tr_TR.js');
const uk_UA = () => import('antd/lib/locale/uk_UA.js');
const ur_PK = () => import('antd/lib/locale/ur_PK.js');
const vi_VN = () => import('antd/lib/locale/vi_VN.js');
const zh_CN = () => import('antd/lib/locale/zh_CN.js');
const zh_HK = () => import('antd/lib/locale/zh_HK.js');
const zh_TW = () => import('antd/lib/locale/zh_TW.js');

const antdLang = {
  "ar_EG": ar_EG,
  "az_AZ": az_AZ,
  "bg_BG": bg_BG,
  "bn_BD": bn_BD,
  "by_BY": by_BY,
  "ca_ES": ca_ES,
  "cs_CZ": cs_CZ,
  "da_DK": da_DK,
  "de_DE": de_DE,
  //"default":default,
  "el_GR": el_GR,
  "en_GB": en_GB,
  "en_US": en_US,
  "es_ES": es_ES,
  "et_EE": et_EE,
  "fa_IR": fa_IR,
  "fi_FI": fi_FI,
  "fr_BE": fr_BE,
  "fr_CA": fr_CA,
  "fr_FR": fr_FR,
  "ga_IE": ga_IE,
  "gl_ES": gl_ES,
  "he_IL": he_IL,
  "hi_IN": hi_IN,
  "hr_HR": hr_HR,
  "hu_HU": hu_HU,
  "hy_AM": hy_AM,
  "id_ID": id_ID,
  "is_IS": is_IS,
  "it_IT": it_IT,
  "ja_JP": ja_JP,
  "ka_GE": ka_GE,
  "kk_KZ": kk_KZ,
  "km_KH": km_KH,
  "kmr_IQ": kmr_IQ,
  "kn_IN": kn_IN,
  "ko_KR": ko_KR,
  "ku_IQ": ku_IQ,
  "lt_LT": lt_LT,
  "lv_LV": lv_LV,
  "mk_MK": mk_MK,
  "ml_IN": ml_IN,
  "mn_MN": mn_MN,
  "ms_MY": ms_MY,
  "nb_NO": nb_NO,
  "ne_NP": ne_NP,
  "nl_BE": nl_BE,
  "nl_NL": nl_NL,
  "pl_PL": pl_PL,
  "pt_BR": pt_BR,
  "pt_PT": pt_PT,
  "ro_RO": ro_RO,
  "ru_RU": ru_RU,
  "sk_SK": sk_SK,
  "sl_SI": sl_SI,
  "sr_RS": sr_RS,
  "sv_SE": sv_SE,
  "ta_IN": ta_IN,
  "th_TH": th_TH,
  "tr_TR": tr_TR,
  "uk_UA": uk_UA,
  "ur_PK": ur_PK,
  "vi_VN": vi_VN,
  "zh_CN": zh_CN,
  "zh_HK": zh_HK,
  "zh_TW": zh_TW,

}
const localizeToPrincipleMap: Record<string, keyof typeof antdLang | ""> = {
  "zh": "zh_CN",
  "zh_tw": "zh_TW",
  "en": "en_US",
  "de": "de_DE",
  "it": "it_IT",
  "es": "es_ES",
  "fr": "fr_FR",
  "ja": "ja_JP",
  "ko": "ko_KR",
  "he": "he_IL",
  "pt": "pt_PT",
  "th": "th_TH",
  "ru": "ru_RU",
  "el": "el_GR",
  "pl": "pl_PL",
  "id": "id_ID",
  "ms": "ms_MY",
  "ar": "ar_EG",
  "bg": "bg_BG",
  "cs": "cs_CZ",
  "nl": "nl_NL",
  "tr": "tr_TR",
  "hu": "hu_HU",
  "vi": "vi_VN",
  "kk": "kk_KZ",
  "no": "nb_NO",
  "da": "da_DK",
  "fi": "fi_FI",
  "sv": "sv_SE",
  "ro": "ro_RO",
  "hi": "hi_IN",
  "uk": "uk_UA",
  "sk": "sk_SK",
  "bn": "bn_BD",
  "ur": "ur_PK",
  "uz": "",
  "ug": "",
  "mn": "mn_MN",
  "mk": "mk_MK",
  "tl": "",
  "hr": "hr_HR",
  "my": "",
  "lt": "lt_LT",
  "sr": "sr_RS",
  "sl": "sl_SI",
  "et": "et_EE",
  "lv": "lv_LV",
  "lo": "",
  "ha": "",
  "fa": "fa_IR",
  "bs": "",
  "ne": "ne_NP",
  "la": "",
  "sw": "",
  "te": "",
  "mr": "",
  "be": "by_BY",
  "rw": "",
  "xh": "",
  "az": "az_AZ",
  "ks": "",
  "jv": "",
  "ta": "ta_IN",
  "gu": "",
  "en_GB": "en_GB",
  "zh_Hant_HK": "zh_HK",
  "pt_BR": "pt_BR",
  "es_419": "",
  "hy": "hy_AM"
};

type LangKey = keyof typeof localizeToPrincipleMap;

async function getThirdLang(key: LangKey) {
  const keyOfAntd = localizeToPrincipleMap[key];
  if (!keyOfAntd || keyOfAntd === 'en_US') {
    return antdLang.en_US
  }
  return antdLang[keyOfAntd]().catch(() => antdLang.en_US);
}

export function useAntdLang(langKey: string) {
  const [antdLang, setAntdLang] = useState({
    loading: true,
    lang: {},
  });
  useEffect(() => {
    getThirdLang(langKey).then((lang: any) => {
      setAntdLang({
        lang: lang.default,
        loading: false,
      });
    });
  }, []);
  return antdLang as any;
}
