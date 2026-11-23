import type { SymptomId } from "./profile";

/**
 * 운동 라이브러리.
 *
 * 앱이 보여주는 운동은 전부 여기서 나온다. AI는 이 목록의 id만 고를 수 있다.
 * 내용은 공개된 산후 운동 가이드라인을 바탕으로 한 초안이며,
 * 출시 전 산부인과 전문의·산후 재활 전문가의 감수가 필요하다.
 */

export type Phase = 0 | 1 | 2 | 3;

export type Category =
  | "breathing"
  | "pelvic_floor"
  | "mobility"
  | "core"
  | "strength"
  | "cardio";

export const CATEGORY_LABEL: Record<Category, string> = {
  breathing: "호흡",
  pelvic_floor: "골반저근",
  mobility: "풀어주기",
  core: "코어",
  strength: "근력",
  cardio: "유산소",
};

/** 루틴 안에서의 진행 순서 */
export const CATEGORY_ORDER: Category[] = [
  "breathing",
  "pelvic_floor",
  "mobility",
  "core",
  "strength",
  "cardio",
];

export interface Exercise {
  id: string;
  name: string;
  /** 이 단계부터 할 수 있다 */
  phase: Phase;
  category: Category;
  /** 대략 걸리는 시간(분) */
  minutes: number;
  sets: number;
  reps: string;
  summary: string;
  steps: string[];
  breathing: string;
  cautions: string[];
  /** 이 증상이 있으면 루틴에서 뺀다 */
  excludeSymptoms: SymptomId[];
  /** 이 증상이 있으면 먼저 넣는다 */
  helps: SymptomId[];
  /** 제왕절개인 경우 이 주차부터 */
  cesareanMinWeeks?: number;
}

export const EXERCISES: Exercise[] = [
  {
    id: "diaphragm-breathing",
    name: "횡격막 호흡",
    phase: 0,
    category: "breathing",
    minutes: 3,
    sets: 1,
    reps: "10회 호흡",
    summary: "갈비뼈를 옆으로 넓히며 깊게 숨 쉬어 코어와 골반저근을 다시 연결해요.",
    steps: [
      "무릎을 세우고 편하게 눕거나 등을 기대고 앉아요.",
      "양손을 갈비뼈 옆에 올려요.",
      "코로 숨을 들이마시며 갈비뼈가 옆과 뒤로 넓어지는 걸 느껴요.",
      "입으로 길게 내쉬며 갈비뼈가 모이고 아랫배가 살짝 들어가는 걸 느껴요.",
    ],
    breathing: "들숨 4초, 날숨 6초. 어깨는 올라가지 않게 해요.",
    cautions: ["어지러우면 평소 호흡으로 돌아가 잠시 쉬어요."],
    excludeSymptoms: [],
    helps: ["diastasis", "incontinence", "back_pain"],
  },
  {
    id: "pelvic-floor-contraction",
    name: "골반저근 조이기",
    phase: 0,
    category: "pelvic_floor",
    minutes: 3,
    sets: 2,
    reps: "10회",
    summary: "소변을 참듯 아래를 부드럽게 끌어올렸다가 완전히 풀어요.",
    steps: [
      "편하게 눕거나 앉아 엉덩이와 허벅지 힘을 빼요.",
      "숨을 내쉬며 질과 항문 주변을 안쪽 위로 살짝 끌어올려요.",
      "3~5초 유지한 뒤 숨을 들이마시며 끝까지 풀어요.",
      "조이는 시간만큼 충분히 쉬고 다음 회를 해요.",
    ],
    breathing: "내쉴 때 조이고, 들이마실 때 풀어요. 숨을 참지 않아요.",
    cautions: [
      "엉덩이나 배에 힘이 들어가면 강도를 절반으로 낮춰요.",
      "조일 때 통증이 있으면 멈추고 진료 때 이야기해요.",
    ],
    excludeSymptoms: [],
    helps: ["incontinence"],
  },
  {
    id: "ankle-pumps",
    name: "발목 펌프",
    phase: 0,
    category: "mobility",
    minutes: 2,
    sets: 2,
    reps: "20회",
    summary: "누운 채 발목을 당겼다 밀어 다리 혈액순환을 도와요.",
    steps: [
      "다리를 펴고 편하게 누워요.",
      "발끝을 몸 쪽으로 끝까지 당겨요.",
      "발끝을 멀리 밀어내요.",
      "천천히 리듬을 지키며 반복해요.",
    ],
    breathing: "자연스럽게 호흡해요.",
    cautions: ["한쪽 종아리만 붓고 아프면 하지 말고 바로 진료를 받아요."],
    excludeSymptoms: [],
    helps: [],
  },
  {
    id: "neck-shoulder-release",
    name: "목·어깨 풀기",
    phase: 0,
    category: "mobility",
    minutes: 3,
    sets: 1,
    reps: "방향마다 5회",
    summary: "수유와 아기 안기로 굳은 목과 어깨를 풀어요.",
    steps: [
      "등을 세우고 앉아 어깨 힘을 빼요.",
      "어깨를 귀 쪽으로 올렸다가 뒤로 크게 돌려 내려요.",
      "고개를 한쪽으로 기울여 목 옆을 15초 늘려요.",
      "반대쪽도 같은 방법으로 해요.",
    ],
    breathing: "늘릴 때 길게 내쉬어요.",
    cautions: ["손이 저리거나 찌릿하면 범위를 줄여요."],
    excludeSymptoms: [],
    helps: ["back_pain"],
  },
  {
    id: "wrist-stretch",
    name: "손목·엄지 스트레칭",
    phase: 0,
    category: "mobility",
    minutes: 2,
    sets: 2,
    reps: "한 손 15초",
    summary: "아기를 안느라 무리한 손목과 엄지 쪽 힘줄을 부드럽게 늘려요.",
    steps: [
      "한 팔을 앞으로 펴고 손바닥을 아래로 향해요.",
      "반대 손으로 손등을 눌러 손목 위쪽을 늘려요.",
      "손바닥을 위로 돌려 손가락을 아래로 당겨 손목 안쪽을 늘려요.",
      "엄지를 손바닥 안에 넣고 주먹을 쥔 뒤 새끼손가락 쪽으로 살짝 꺾어요.",
    ],
    breathing: "자연스럽게 호흡해요.",
    cautions: ["찌르는 통증이 나면 그 전 범위까지만 해요."],
    excludeSymptoms: [],
    helps: ["wrist_pain"],
  },
  {
    id: "gentle-walk",
    name: "가볍게 걷기",
    phase: 0,
    category: "cardio",
    minutes: 10,
    sets: 1,
    reps: "10분",
    summary: "대화할 수 있는 속도로 평지를 걸어요.",
    steps: [
      "편한 신발을 신고 평지에서 시작해요.",
      "시선은 앞을 보고 팔은 자연스럽게 흔들어요.",
      "숨이 차지 않고 말할 수 있는 속도를 유지해요.",
      "마지막 1~2분은 속도를 줄여 마무리해요.",
    ],
    breathing: "코로 들이마시고 입으로 내쉬는 편한 호흡이에요.",
    cautions: [
      "걷고 난 뒤 출혈이 늘면 다음 날은 시간을 절반으로 줄여요.",
      "아래가 묵직하게 빠지는 느낌이 들면 멈추고 쉬어요.",
    ],
    excludeSymptoms: [],
    helps: [],
  },
  {
    id: "tva-activation",
    name: "복횡근 깨우기",
    phase: 1,
    category: "core",
    minutes: 3,
    sets: 2,
    reps: "8회",
    summary: "숨을 내쉬며 아랫배를 코르셋처럼 얇게 조여요.",
    steps: [
      "무릎을 세우고 누워 손가락을 골반뼈 안쪽에 올려요.",
      "숨을 들이마셔 갈비뼈를 넓혀요.",
      "길게 내쉬며 아랫배를 척추 쪽으로 살짝 당겨요. 손끝에 단단함이 느껴져요.",
      "5초 유지하고 풀어요. 허리는 바닥에서 뜨거나 눌리지 않게 해요.",
    ],
    breathing: "내쉬는 숨에 조이고, 유지하는 동안에도 가볍게 숨 쉬어요.",
    cautions: [
      "배 가운데가 볼록 솟으면 강도를 낮춰요.",
      "제왕절개 흉터가 당기면 범위를 줄이거나 쉬어요.",
    ],
    excludeSymptoms: [],
    helps: ["diastasis", "back_pain"],
    cesareanMinWeeks: 6,
  },
  {
    id: "pelvic-tilt",
    name: "골반 기울이기",
    phase: 1,
    category: "core",
    minutes: 3,
    sets: 2,
    reps: "10회",
    summary: "누워서 골반을 앞뒤로 굴려 허리 긴장을 풀고 아랫배를 써요.",
    steps: [
      "무릎을 세우고 누워 발을 골반 너비로 둬요.",
      "숨을 내쉬며 꼬리뼈를 살짝 말아 허리를 바닥 쪽으로 눌러요.",
      "숨을 들이마시며 원래 자리로 돌아와요.",
      "엉덩이는 바닥에서 떨어지지 않게 해요.",
    ],
    breathing: "내쉴 때 말고, 들이마실 때 돌아와요.",
    cautions: ["허리가 아프면 움직임을 작게 해요."],
    excludeSymptoms: [],
    helps: ["back_pain"],
    cesareanMinWeeks: 6,
  },
  {
    id: "heel-slide",
    name: "발뒤꿈치 밀기",
    phase: 1,
    category: "core",
    minutes: 3,
    sets: 2,
    reps: "한쪽 8회",
    summary: "아랫배 힘을 유지한 채 한쪽 다리를 천천히 펴요.",
    steps: [
      "무릎을 세우고 누워 아랫배를 가볍게 조여요.",
      "숨을 내쉬며 한쪽 발뒤꿈치를 바닥에 대고 다리를 밀어 펴요.",
      "골반이 좌우로 흔들리지 않게 해요.",
      "숨을 들이마시며 다시 당겨 와요. 반대쪽도 해요.",
    ],
    breathing: "다리를 펼 때 내쉬어요.",
    cautions: ["허리가 바닥에서 뜨면 다리를 덜 펴요."],
    excludeSymptoms: [],
    helps: ["diastasis"],
    cesareanMinWeeks: 6,
  },
  {
    id: "cat-cow",
    name: "고양이-소 자세",
    phase: 1,
    category: "mobility",
    minutes: 3,
    sets: 1,
    reps: "10회",
    summary: "네발 자세에서 척추를 둥글게 말았다 펴요.",
    steps: [
      "손은 어깨 아래, 무릎은 골반 아래에 둬요.",
      "숨을 내쉬며 등을 천장 쪽으로 둥글게 말아요.",
      "숨을 들이마시며 가슴을 앞으로 열어 등을 펴요.",
      "배를 아래로 툭 떨어뜨리지 말고 펴는 범위를 작게 해요.",
    ],
    breathing: "말 때 내쉬고, 펼 때 들이마셔요.",
    cautions: [
      "손목이 아프면 주먹을 쥐고 짚거나 팔꿈치로 내려가요.",
      "배 가운데가 솟으면 펴는 동작을 생략해요.",
    ],
    excludeSymptoms: [],
    helps: ["back_pain"],
    cesareanMinWeeks: 6,
  },
  {
    id: "glute-bridge",
    name: "브리지",
    phase: 2,
    category: "strength",
    minutes: 4,
    sets: 2,
    reps: "10회",
    summary: "엉덩이 힘으로 골반을 들어 올려 허리와 골반을 받쳐요.",
    steps: [
      "무릎을 세우고 누워 발을 골반 너비로 둬요.",
      "숨을 내쉬며 엉덩이를 조여 골반을 들어 올려요.",
      "어깨부터 무릎까지 일직선이 되면 2초 멈춰요.",
      "척추를 위에서부터 하나씩 내려놓아요.",
    ],
    breathing: "올릴 때 내쉬고, 내릴 때 들이마셔요.",
    cautions: [
      "허리가 꺾이지 않게 갈비뼈를 닫아요.",
      "골반 앞쪽이 아프면 높이를 낮춰요.",
    ],
    excludeSymptoms: [],
    helps: ["back_pain", "pelvic_pain"],
    cesareanMinWeeks: 8,
  },
  {
    id: "clamshell",
    name: "조개 열기",
    phase: 2,
    category: "strength",
    minutes: 4,
    sets: 2,
    reps: "한쪽 12회",
    summary: "옆으로 누워 무릎을 열어 엉덩이 옆 근육을 키워요.",
    steps: [
      "옆으로 누워 무릎을 구부리고 발을 포개요.",
      "발은 붙인 채 위쪽 무릎을 천장 쪽으로 열어요.",
      "골반이 뒤로 넘어가지 않는 범위까지만 열어요.",
      "천천히 닫아요. 반대쪽도 해요.",
    ],
    breathing: "열 때 내쉬어요.",
    cautions: ["치골 쪽이 아프면 여는 범위를 절반으로 줄여요."],
    excludeSymptoms: [],
    helps: ["pelvic_pain", "back_pain"],
  },
  {
    id: "bird-dog",
    name: "버드독",
    phase: 2,
    category: "core",
    minutes: 4,
    sets: 2,
    reps: "한쪽 6회",
    summary: "네발 자세에서 반대쪽 팔과 다리를 뻗어 몸통을 고정해요.",
    steps: [
      "손은 어깨 아래, 무릎은 골반 아래에 두고 아랫배를 가볍게 조여요.",
      "숨을 내쉬며 한쪽 다리를 뒤로 밀어 뻗어요.",
      "흔들리지 않으면 반대쪽 팔도 앞으로 뻗어요.",
      "3초 유지하고 돌아와요. 반대쪽도 해요.",
    ],
    breathing: "뻗을 때 내쉬고, 유지하는 동안 숨을 참지 않아요.",
    cautions: [
      "배 가운데가 솟거나 아래로 처지면 다리만 뻗어요.",
      "손목이 아프면 주먹을 쥐고 짚어요.",
    ],
    excludeSymptoms: [],
    helps: ["back_pain"],
    cesareanMinWeeks: 8,
  },
  {
    id: "wall-squat",
    name: "벽 스쿼트",
    phase: 2,
    category: "strength",
    minutes: 4,
    sets: 2,
    reps: "8회",
    summary: "등을 벽에 대고 얕게 앉았다 일어나 하체를 깨워요.",
    steps: [
      "등을 벽에 대고 발을 한 걸음 앞에 골반 너비로 둬요.",
      "숨을 들이마시며 벽을 타고 무릎이 45도쯤 될 때까지 내려가요.",
      "숨을 내쉬며 발바닥으로 바닥을 밀어 올라와요.",
      "무릎이 안으로 모이지 않게 해요.",
    ],
    breathing: "내려갈 때 들이마시고, 올라올 때 내쉬어요.",
    cautions: [
      "아래가 묵직하게 빠지는 느낌이 들면 깊이를 줄여요.",
      "골반 통증이 있으면 발 간격을 좁혀요.",
    ],
    excludeSymptoms: [],
    helps: [],
  },
  {
    id: "side-leg-lift",
    name: "옆으로 누워 다리 들기",
    phase: 2,
    category: "strength",
    minutes: 4,
    sets: 2,
    reps: "한쪽 10회",
    summary: "옆으로 누워 위쪽 다리를 들어 골반 옆을 단단하게 해요.",
    steps: [
      "옆으로 누워 아래쪽 무릎을 구부려 균형을 잡아요.",
      "위쪽 다리를 곧게 펴고 발끝은 앞을 향해요.",
      "숨을 내쉬며 다리를 골반 높이보다 조금 위까지 들어요.",
      "천천히 내려요. 반대쪽도 해요.",
    ],
    breathing: "들 때 내쉬어요.",
    cautions: ["허리가 꺾이지 않게 몸통을 길게 유지해요."],
    excludeSymptoms: ["pelvic_pain"],
    helps: [],
  },
  {
    id: "dead-bug",
    name: "데드버그",
    phase: 3,
    category: "core",
    minutes: 4,
    sets: 2,
    reps: "한쪽 6회",
    summary: "누워서 반대쪽 팔과 다리를 천천히 내려 코어 조절력을 키워요.",
    steps: [
      "누워서 무릎과 엉덩이를 90도로 들고 팔은 천장으로 뻗어요.",
      "허리와 바닥 사이 간격을 그대로 유지해요.",
      "숨을 내쉬며 한쪽 다리와 반대쪽 팔을 바닥 가까이 내려요.",
      "돌아와서 반대쪽을 해요.",
    ],
    breathing: "내릴 때 길게 내쉬어요.",
    cautions: ["허리가 뜨면 다리를 덜 내려요."],
    excludeSymptoms: ["diastasis"],
    helps: [],
    cesareanMinWeeks: 12,
  },
  {
    id: "knee-plank",
    name: "무릎 플랭크",
    phase: 3,
    category: "core",
    minutes: 3,
    sets: 3,
    reps: "15초",
    summary: "무릎을 대고 몸통을 일직선으로 버텨요.",
    steps: [
      "팔꿈치를 어깨 아래에 두고 무릎을 바닥에 대요.",
      "어깨부터 무릎까지 일직선을 만들어요.",
      "아랫배를 가볍게 조이고 엉덩이가 솟거나 처지지 않게 해요.",
      "15초 버티고 쉬어요.",
    ],
    breathing: "버티는 동안 짧게 계속 숨 쉬어요.",
    cautions: [
      "배 가운데가 솟으면 바로 멈춰요.",
      "소변이 새거나 아래가 묵직하면 시간을 줄여요.",
    ],
    excludeSymptoms: ["diastasis", "incontinence"],
    helps: [],
    cesareanMinWeeks: 12,
  },
  {
    id: "bodyweight-squat",
    name: "맨몸 스쿼트",
    phase: 3,
    category: "strength",
    minutes: 4,
    sets: 2,
    reps: "12회",
    summary: "아기를 들고 앉았다 일어나는 힘을 길러요.",
    steps: [
      "발을 어깨너비로 벌리고 발끝은 살짝 바깥을 향해요.",
      "엉덩이를 뒤로 빼며 의자에 앉듯 내려가요.",
      "허벅지가 바닥과 평행해지기 전까지만 내려가요.",
      "숨을 내쉬며 발바닥 전체로 밀어 일어나요.",
    ],
    breathing: "내려갈 때 들이마시고, 올라올 때 내쉬어요.",
    cautions: ["무릎이 안으로 모이지 않게 해요."],
    excludeSymptoms: [],
    helps: [],
  },
  {
    id: "reverse-lunge",
    name: "뒤로 런지",
    phase: 3,
    category: "strength",
    minutes: 4,
    sets: 2,
    reps: "한쪽 8회",
    summary: "한 발을 뒤로 디뎌 한쪽씩 하체와 균형을 길러요.",
    steps: [
      "골반 너비로 서서 필요하면 의자를 잡아요.",
      "한 발을 뒤로 크게 디뎌요.",
      "두 무릎을 구부려 뒤 무릎이 바닥 가까이 가게 내려가요.",
      "앞발로 밀어 돌아와요. 반대쪽도 해요.",
    ],
    breathing: "내려갈 때 들이마시고, 올라올 때 내쉬어요.",
    cautions: ["골반이 틀어지지 않게 정면을 유지해요."],
    excludeSymptoms: ["pelvic_pain"],
    helps: [],
  },
  {
    id: "brisk-walk",
    name: "빠르게 걷기",
    phase: 2,
    category: "cardio",
    minutes: 10,
    sets: 1,
    reps: "10분",
    summary: "살짝 숨이 차는 속도로 걸어 지구력을 되찾아요.",
    steps: [
      "2분은 평소 속도로 걸으며 몸을 풀어요.",
      "보폭은 그대로 두고 걸음 수를 늘려 속도를 올려요.",
      "짧은 문장은 말할 수 있는 정도를 유지해요.",
      "마지막 2분은 천천히 걸어요.",
    ],
    breathing: "리듬 있게 호흡해요.",
    cautions: ["소변이 새거나 아래가 묵직하면 속도를 낮춰요."],
    excludeSymptoms: [],
    helps: [],
  },
  {
    id: "walk-jog-interval",
    name: "걷고 뛰기",
    phase: 3,
    category: "cardio",
    minutes: 10,
    sets: 5,
    reps: "1분 뛰기 + 1분 걷기",
    summary: "짧게 뛰고 걷기를 번갈아 하며 달리기로 돌아가요.",
    steps: [
      "3분 걸으며 몸을 풀어요.",
      "가볍게 1분 뛰어요. 발소리가 작게 나도록 해요.",
      "1분 걸으며 숨을 고르고 다시 뛰어요.",
      "끝나면 2분 천천히 걸어요.",
    ],
    breathing: "숨이 가빠 말을 못 할 정도면 걷는 시간을 늘려요.",
    cautions: [
      "소변이 새거나 골반·아래가 묵직하면 걷기로 바꿔요.",
      "뛰는 동안이나 뒤에 통증이 있으면 한 단계 낮춰요.",
    ],
    excludeSymptoms: ["incontinence", "pelvic_pain", "diastasis"],
    helps: [],
  },
];

const BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}
