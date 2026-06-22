const quizState = {
  mode: null,
  particleId: null,
  topic: null,
  difficulty: null,
  answers: {
    q1Estimate: null,
    q2Choice: null,
    q3MapPoint: null,
    q4Timeline: null
  }
};

function getQuizState() {
  return quizState;
}

function setQuizMode(mode) {
  quizState.mode = mode;
}

function setParticleId(id) {
  quizState.particleId = id;
}

function setTopic(topic) {
  quizState.topic = topic;
}

function setDifficulty(difficulty) {
  quizState.difficulty = difficulty;
}

function setAnswer(key, value) {
  if (!quizState.answers || !(key in quizState.answers)) return;
  quizState.answers[key] = value;
}

function resetQuizState() {
  quizState.mode = null;
  quizState.particleId = null;
  quizState.topic = null;
  quizState.difficulty = null;
  quizState.answers = {
    q1Estimate: null,
    q2Choice: null,
    q3MapPoint: null,
    q4Timeline: null
  };
}
