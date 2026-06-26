const QUIZ_SCORING = {
  maxPointsPerQuestion: 25,
  maxTotalPoints: 100,
  correct: {
    q1Estimate: 750000000,
    q2Choice: 3,
    // Vatican on assets/2090778_282803-P6L1SP-801.svg (normalized 0–1 on square map)
    q3MapPoint: { x: 0.480, y: 0.810 },
    // EU (Maastricht) — 1993 on the timeline year scale
    q4Timeline: 1604.28 / 3840
  },
  estimateTolerance: 20,
  mapTolerance: 0.15,
  timelineTolerance: 0.15
};

function scoreFromRatio(ratio, maxPoints) {
  return Math.round(Math.max(0, Math.min(1, ratio)) * maxPoints);
}

function scoreEstimate(user, correct, maxPoints, tolerance) {
  if (user == null || !Number.isFinite(user)) return 0;
  const diff = Math.abs(user - correct);
  if (diff <= tolerance) return maxPoints;
  return scoreFromRatio(1 - (diff - tolerance) / tolerance, maxPoints);
}

function scoreChoice(user, correct, maxPoints) {
  return user === correct ? maxPoints : 0;
}

function scoreMapPoint(user, correct, maxPoints) {
  if (!user) return 0;
  if (typeof europeMap !== 'undefined' && europeMap.isMapAnswerCorrect(user)) {
    return maxPoints;
  }
  return 0;
}

function scoreTimeline(user, correct, maxPoints) {
  if (user == null || !Number.isFinite(user)) return 0;
  if (typeof quizTimeline !== 'undefined' && quizTimeline.isTimelineAnswerCorrect(user)) {
    return maxPoints;
  }
  return 0;
}

function calculateQuizScore(answers) {
  const a = answers ?? getQuizState().answers ?? {};
  const { maxPointsPerQuestion, correct } = QUIZ_SCORING;

  const breakdown = {
    q1Estimate: scoreEstimate(
      a.q1Estimate,
      correct.q1Estimate,
      maxPointsPerQuestion,
      QUIZ_SCORING.estimateTolerance
    ),
    q2Choice: scoreChoice(a.q2Choice, 3, maxPointsPerQuestion),
    q3MapPoint: scoreMapPoint(
      a.q3MapPoint,
      correct.q3MapPoint,
      maxPointsPerQuestion
    ),
    q4Timeline: scoreTimeline(
      a.q4Timeline,
      correct.q4Timeline,
      maxPointsPerQuestion
    )
  };

  const total = breakdown.q1Estimate
    + breakdown.q2Choice
    + breakdown.q3MapPoint
    + breakdown.q4Timeline;

  return { total, breakdown, maxTotal: QUIZ_SCORING.maxTotalPoints };
}

function isAnswerCorrect(key, answers) {
  const a = answers ?? getQuizState().answers ?? {};
  const { correct } = QUIZ_SCORING;

  switch (key) {
    case 'q1Estimate':
      return a.q1Estimate === correct.q1Estimate;
    case 'q2Choice':
      return a.q2Choice === correct.q2Choice;
    case 'q3MapPoint':
      return typeof europeMap !== 'undefined'
        && europeMap.isMapAnswerCorrect(a.q3MapPoint);
    case 'q4Timeline':
      return typeof quizTimeline !== 'undefined'
        && quizTimeline.isTimelineAnswerCorrect(a.q4Timeline);
    default:
      return false;
  }
}

function countAnswerResults(answers) {
  const keys = ['q1Estimate', 'q2Choice', 'q3MapPoint', 'q4Timeline'];
  let correct = 0;
  let wrong = 0;
  const breakdown = {};
  for (const key of keys) {
    const ok = isAnswerCorrect(key, answers);
    breakdown[key] = ok;
    if (ok) correct += 1;
    else wrong += 1;
  }
  return { correct, wrong, breakdown };
}

const LEADERBOARD_MOCK_ENTRIES = [
  { name: 'Kira', score: 90 },
  { name: 'Jakob', score: 50 },
  { name: 'Florian', score: 10 }
];

function getLeaderboardEntries(playerScore, playerName = 'Du') {
  return [...LEADERBOARD_MOCK_ENTRIES, { name: playerName, score: playerScore }]
    .sort((a, b) => b.score - a.score);
}
