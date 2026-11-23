/**
 * 운동보다 진료가 먼저인 위험 증상.
 * 온보딩 체크리스트와 채팅/메모 키워드 감지에 같은 목록을 쓴다.
 * AI 판단에 맡기지 않고 규칙으로 먼저 걸러낸다.
 */
export const RED_FLAG_IDS = [
  "bleeding",
  "fever",
  "calf",
  "chest",
  "headache",
  "wound",
  "mood",
] as const;

export type RedFlagId = (typeof RED_FLAG_IDS)[number];

export interface RedFlag {
  id: RedFlagId;
  /** 체크리스트 문구 */
  label: string;
  /** 감지됐을 때 보여줄 안내 */
  advice: string;
  /** 자유 입력에서 찾는 표현 */
  patterns: RegExp[];
  /** 즉시 119가 필요한 수준인지 */
  emergency: boolean;
}

export const RED_FLAGS: RedFlag[] = [
  {
    id: "bleeding",
    label: "1시간에 패드 1장 이상 젖는 출혈, 또는 큰 핏덩이",
    advice:
      "갑자기 늘어난 출혈은 산후 출혈일 수 있어요. 운동을 멈추고 바로 분만 병원이나 응급실에 연락하세요.",
    patterns: [
      /하혈/,
      /핏덩/,
      /출혈.{0,8}(많|심|늘|갑자기|멈추지|계속)/,
      /(많|심|갑자기|계속).{0,8}출혈/,
      /피가?\s*(많이|계속|갑자기)\s*(나|나와|쏟)/,
    ],
    emergency: true,
  },
  {
    id: "fever",
    label: "38℃ 이상의 열 또는 오한",
    advice:
      "산후 발열은 감염 신호일 수 있어요. 오늘은 쉬고 병원에 연락해 진료를 받으세요.",
    patterns: [/3[89]\s*(도|℃)/, /고열/, /오한/, /열이?\s*(나|심|안\s*내려|높)/],
    emergency: false,
  },
  {
    id: "calf",
    label: "한쪽 종아리가 붓고 아프거나 뜨거움",
    advice:
      "한쪽 다리만 붓고 아프면 혈전일 수 있어요. 주무르지 말고 바로 진료를 받으세요.",
    patterns: [
      /종아리.{0,10}(아프|아파|통증|붓|부었|부어|부기|열감|뜨거)/,
      /한쪽\s*다리.{0,10}(붓|부었|부어|아프|아파)/,
      /혈전/,
    ],
    emergency: true,
  },
  {
    id: "chest",
    label: "가슴 통증, 또는 가만히 있어도 숨이 참",
    advice:
      "가슴 통증이나 호흡곤란은 응급 상황일 수 있어요. 지금 바로 119에 전화하세요.",
    patterns: [
      /흉통/,
      /가슴.{0,8}(아프|아파|통증|답답|조이|쥐어)/,
      /숨이?\s*(차|안\s*쉬어|막히|가빠|가쁘)/,
      /호흡\s*곤란/,
    ],
    emergency: true,
  },
  {
    id: "headache",
    label: "심한 두통, 시야 흐림, 갑자기 심해진 얼굴·손 부기",
    advice:
      "심한 두통과 시야 이상은 산후 고혈압 질환의 신호일 수 있어요. 바로 병원에 연락하세요.",
    patterns: [
      /(심한|극심한|깨질\s*듯)\s*두통/,
      /두통.{0,8}(심|안\s*없어|계속)/,
      /시야.{0,8}(흐|이상|번쩍|안\s*보)/,
      /눈앞이\s*(흐|캄캄|번쩍)/,
    ],
    emergency: true,
  },
  {
    id: "wound",
    label: "수술·회음부 상처가 붉어지고 고름이 나거나 통증이 심해짐",
    advice:
      "상처 감염이 의심돼요. 상처 부위에 힘이 들어가는 동작은 멈추고 진료를 받으세요.",
    patterns: [
      /고름/,
      /진물/,
      /상처.{0,10}(벌어|붉|빨갛|냄새|뜨거|부었|부어)/,
      /(수술|절개|회음).{0,10}(벌어|고름|진물|냄새)/,
    ],
    emergency: false,
  },
  {
    id: "mood",
    label: "나 자신이나 아기를 해칠 것 같은 생각",
    advice:
      "혼자 견디지 않아도 돼요. 지금 자살예방상담전화 109(24시간)나 119에 전화하고, 가까운 사람에게 곁에 있어 달라고 말해 주세요.",
    patterns: [
      /죽고\s*싶/,
      /자해/,
      /자살/,
      /(나|아기|애기|아이)를?\s*해치/,
      /사라지고\s*싶/,
      /살기\s*싫/,
    ],
    emergency: true,
  },
];

const BY_ID = new Map(RED_FLAGS.map((flag) => [flag.id, flag]));

export function getRedFlag(id: RedFlagId): RedFlag {
  const flag = BY_ID.get(id);
  if (!flag) throw new Error(`unknown red flag: ${id}`);
  return flag;
}

/** 자유 입력 문장에서 위험 증상을 찾는다. */
export function detectRedFlags(text: string): RedFlagId[] {
  const normalized = text.normalize("NFC");
  return RED_FLAGS.filter((flag) =>
    flag.patterns.some((pattern) => pattern.test(normalized)),
  ).map((flag) => flag.id);
}

/** 감지된 위험 증상에 대한 고정 안내문. AI 답변 앞에 그대로 붙인다. */
export function redFlagNotice(ids: RedFlagId[]): string {
  if (ids.length === 0) return "";
  const lines = ids.map((id) => `- ${getRedFlag(id).advice}`);
  return [
    "말씀하신 증상은 운동보다 진료가 먼저예요.",
    ...lines,
    "아래 내용은 일반 정보이며 진료를 대신하지 않아요.",
  ].join("\n");
}
