export interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const rows = `AF|Afganistán|+93|🇦🇫
AS|Samoa Americana|+1684|🇦🇸
AL|Albania|+355|🇦🇱
DZ|Argelia|+213|🇩🇿
AD|Andorra|+376|🇦🇩
AO|Angola|+244|🇦🇴
AI|Anguila|+1264|🇦🇮
AQ|Antártida|+672|🇦🇶
AG|Antigua y Barbuda|+1268|🇦🇬
AR|Argentina|+54|🇦🇷
AM|Armenia|+374|🇦🇲
AU|Australia|+61|🇦🇺
AT|Austria|+43|🇦🇹
AZ|Azerbaiyán|+994|🇦🇿
AW|Aruba|+297|🇦🇼
BS|Bahamas|+1242|🇧🇸
BH|Baréin|+973|🇧🇭
BD|Bangladés|+880|🇧🇩
BB|Barbados|+1246|🇧🇧
BE|Bélgica|+32|🇧🇪
BZ|Belice|+501|🇧🇿
BJ|Benín|+229|🇧🇯
BT|Bután|+975|🇧🇹
BO|Bolivia|+591|🇧🇴
BA|Bosnia y Herzegovina|+387|🇧🇦
BW|Botsuana|+267|🇧🇼
BR|Brasil|+55|🇧🇷
BN|Brunéi|+673|🇧🇳
BG|Bulgaria|+359|🇧🇬
BF|Burkina Faso|+226|🇧🇫
BI|Burundi|+257|🇧🇮
BM|Bermudas|+1441|🇧🇲
KH|Camboya|+855|🇰🇭
CM|Camerún|+237|🇨🇲
CA|Canadá|+1|🇨🇦
CV|Cabo Verde|+238|🇨🇻
KY|Islas Caimán|+1345|🇰🇾
CL|Chile|+56|🇨🇱
CN|China|+86|🇨🇳
CO|Colombia|+57|🇨🇴
KM|Comoras|+269|🇰🇲
CG|Congo|+242|🇨🇬
CD|Congo (R. D.)|+243|🇨🇩
CR|Costa Rica|+506|🇨🇷
CI|Costa de Marfil|+225|🇨🇮
HR|Croacia|+385|🇭🇷
CU|Cuba|+53|🇨🇺
CY|Chipre|+357|🇨🇾
CZ|Chequia|+420|🇨🇿
CW|Curazao|+599|🇨🇼
DK|Dinamarca|+45|🇩🇰
DJ|Yibuti|+253|🇩🇯
DM|Dominica|+1767|🇩🇲
DO|República Dominicana|+1809|🇩🇴
EC|Ecuador|+593|🇪🇨
EG|Egipto|+20|🇪🇬
GQ|Guinea Ecuatorial|+240|🇬🇶
ER|Eritrea|+291|🇪🇷
SV|El Salvador|+503|🇸🇻
EE|Estonia|+372|🇪🇪
ET|Etiopía|+251|🇪🇹
SZ|Esuatini|+268|🇸🇿
FK|Islas Malvinas|+500|🇫🇰
FO|Islas Feroe|+298|🇫🇴
FJ|Fiyi|+679|🇫🇯
FI|Finlandia|+358|🇫🇮
FR|Francia|+33|🇫🇷
GF|Guayana Francesa|+594|🇬🇫
PF|Polinesia Francesa|+689|🇵🇫
GA|Gabón|+241|🇬🇦
GM|Gambia|+220|🇬🇲
GE|Georgia|+995|🇬🇪
DE|Alemania|+49|🇩🇪
GH|Ghana|+233|🇬🇭
GI|Gibraltar|+350|🇬🇮
GR|Grecia|+30|🇬🇷
GD|Granada|+1473|🇬🇩
GT|Guatemala|+502|🇬🇹
GL|Groenlandia|+299|🇬🇱
GP|Guadalupe|+590|🇬🇵
GU|Guam|+1671|🇬🇺
GG|Guernsey|+441481|🇬🇬
GN|Guinea|+224|🇬🇳
GW|Guinea-Bisáu|+245|🇬🇼
GY|Guyana|+592|🇬🇾
HT|Haití|+509|🇭🇹
HN|Honduras|+504|🇭🇳
HK|Hong Kong|+852|🇭🇰
HU|Hungría|+36|🇭🇺
IS|Islandia|+354|🇮🇸
IN|India|+91|🇮🇳
ID|Indonesia|+62|🇮🇩
IR|Irán|+98|🇮🇷
IQ|Irak|+964|🇮🇶
IE|Irlanda|+353|🇮🇪
IM|Isla de Man|+441624|🇮🇲
IL|Israel|+972|🇮🇱
IT|Italia|+39|🇮🇹
JE|Jersey|+441534|🇯🇪
JM|Jamaica|+1876|🇯🇲
JP|Japón|+81|🇯🇵
JO|Jordania|+962|🇯🇴
KZ|Kazajistán|+7|🇰🇿
KE|Kenia|+254|🇰🇪
KR|Corea del Sur|+82|🇰🇷
KP|Corea del Norte|+850|🇰🇵
KW|Kuwait|+965|🇰🇼
KG|Kirguistán|+996|🇰🇬
KI|Kiribati|+686|🇰🇮
LA|Laos|+856|🇱🇦
LV|Letonia|+371|🇱🇻
LB|Líbano|+961|🇱🇧
LS|Lesoto|+266|🇱🇸
LR|Liberia|+231|🇱🇷
LY|Libia|+218|🇱🇾
LI|Liechtenstein|+423|🇱🇮
LT|Lituania|+370|🇱🇹
LU|Luxemburgo|+352|🇱🇺
MG|Madagascar|+261|🇲🇬
MO|Macao|+853|🇲🇴
MW|Malaui|+265|🇲🇼
MY|Malasia|+60|🇲🇾
MV|Maldivas|+960|🇲🇻
ML|Malí|+223|🇲🇱
MT|Malta|+356|🇲🇹
MQ|Martinica|+596|🇲🇶
MR|Mauritania|+222|🇲🇷
MU|Mauricio|+230|🇲🇺
MX|México|+52|🇲🇽
YT|Mayotte|+262|🇾🇹
FM|Micronesia|+691|🇫🇲
MD|Moldavia|+373|🇲🇩
MC|Mónaco|+377|🇲🇨
MN|Mongolia|+976|🇲🇳
MS|Montserrat|+1664|🇲🇸
ME|Montenegro|+382|🇲🇪
MA|Marruecos|+212|🇲🇦
MZ|Mozambique|+258|🇲🇿
MM|Myanmar|+95|🇲🇲
NA|Namibia|+264|🇳🇦
NP|Nepal|+977|🇳🇵
NR|Nauru|+674|🇳🇷
NC|Nueva Caledonia|+687|🇳🇨
NL|Países Bajos|+31|🇳🇱
NZ|Nueva Zelanda|+64|🇳🇿
NI|Nicaragua|+505|🇳🇮
NU|Niue|+683|🇳🇺
NF|Isla Norfolk|+672|🇳🇫
MK|Macedonia del Norte|+389|🇲🇰
MP|Islas Marianas del Norte|+1670|🇲🇵
NE|Níger|+227|🇳🇪
NG|Nigeria|+234|🇳🇬
NO|Noruega|+47|🇳🇴
OM|Omán|+968|🇴🇲
PK|Pakistán|+92|🇵🇰
PW|Palaos|+680|🇵🇼
PS|Palestina|+970|🇵🇸
PA|Panamá|+507|🇵🇦
PG|Papúa Nueva Guinea|+675|🇵🇬
PY|Paraguay|+595|🇵🇾
PE|Perú|+51|🇵🇪
PH|Filipinas|+63|🇵🇭
PL|Polonia|+48|🇵🇱
PT|Portugal|+351|🇵🇹
PN|Islas Pitcairn|+64|🇵🇳
PR|Puerto Rico|+1787|🇵🇷
QA|Catar|+974|🇶🇦
RO|Rumania|+40|🇷🇴
RE|Reunión|+262|🇷🇪
RU|Rusia|+7|🇷🇺
RW|Ruanda|+250|🇷🇼
BL|San Bartolomé|+590|🇧🇱
SH|Santa Elena|+290|🇸🇭
KN|San Cristóbal y Nieves|+1869|🇰🇳
LC|Santa Lucía|+1758|🇱🇨
VC|San Vicente y las Granadinas|+1784|🇻🇨
WS|Samoa|+685|🇼🇸
SM|San Marino|+378|🇸🇲
MF|San Martín|+590|🇲🇫
PM|San Pedro y Miquelón|+508|🇵🇲
ST|Santo Tomé y Príncipe|+239|🇸🇹
SA|Arabia Saudita|+966|🇸🇦
SN|Senegal|+221|🇸🇳
RS|Serbia|+381|🇷🇸
SC|Seychelles|+248|🇸🇨
SL|Sierra Leona|+232|🇸🇱
SG|Singapur|+65|🇸🇬
SK|Eslovaquia|+421|🇸🇰
SI|Eslovenia|+386|🇸🇮
SO|Somalia|+252|🇸🇴
SB|Islas Salomón|+677|🇸🇧
ZA|Sudáfrica|+27|🇿🇦
ES|España|+34|🇪🇸
LK|Sri Lanka|+94|🇱🇰
SD|Sudán|+249|🇸🇩
SS|Sudán del Sur|+211|🇸🇸
SR|Surinam|+597|🇸🇷
SE|Suecia|+46|🇸🇪
CH|Suiza|+41|🇨🇭
SY|Siria|+963|🇸🇾
SJ|Svalbard y Jan Mayen|+4779|🇸🇯
TW|Taiwán|+886|🇹🇼
TJ|Tayikistán|+992|🇹🇯
TZ|Tanzania|+255|🇹🇿
TH|Tailandia|+66|🇹🇭
TG|Togo|+228|🇹🇬
TL|Timor Oriental|+670|🇹🇱
TK|Tokelau|+690|🇹🇰
TO|Tonga|+676|🇹🇴
TT|Trinidad y Tobago|+1868|🇹🇹
TN|Túnez|+216|🇹🇳
TR|Turquía|+90|🇹🇷
TC|Islas Turcas y Caicos|+1649|🇹🇨
TV|Tuvalu|+688|🇹🇻
TM|Turkmenistán|+993|🇹🇲
UG|Uganda|+256|🇺🇬
UA|Ucrania|+380|🇺🇦
AE|Emiratos Árabes Unidos|+971|🇦🇪
GB|Reino Unido|+44|🇬🇧
US|Estados Unidos|+1|🇺🇸
UY|Uruguay|+598|🇺🇾
UZ|Uzbekistán|+998|🇺🇿
VU|Vanuatu|+678|🇻🇺
VA|Ciudad del Vaticano|+39|🇻🇦
VE|Venezuela|+58|🇻🇪
VN|Vietnam|+84|🇻🇳
VG|Islas Vírgenes Británicas|+1284|🇻🇬
VI|Islas Vírgenes de EE. UU.|+1340|🇻🇮
WF|Wallis y Futuna|+681|🇼🇫
EH|Sáhara Occidental|+212|🇪🇭
YE|Yemen|+967|🇾🇪
ZM|Zambia|+260|🇿🇲
ZW|Zimbabue|+263|🇿🇼`.split('\n');

export const phoneCountries: PhoneCountry[] = rows.map((row) => {
  const [code, name, dialCode, flag] = row.split('|');
  return { code, name, dialCode, flag };
});

export const panamaPhoneCountry = phoneCountries.find((country) => country.code === 'PA')!;
