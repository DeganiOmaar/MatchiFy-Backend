export const MODEL_KEY = {
  requiredSkillsWeight: 0.6,
  optionalSkillsWeight: 0.2,
  experienceWeight: 0.2,
} as const;

// Helper pour s'assurer que la somme = 1 (sinon on renormalise)
export function getNormalizedWeights() {
  const total =
    MODEL_KEY.requiredSkillsWeight +
    MODEL_KEY.optionalSkillsWeight +
    MODEL_KEY.experienceWeight;

  if (total === 0) {
    return {
      requiredSkillsWeight: 0.6,
      optionalSkillsWeight: 0.2,
      experienceWeight: 0.2,
    };
  }

  return {
    requiredSkillsWeight: MODEL_KEY.requiredSkillsWeight / total,
    optionalSkillsWeight: MODEL_KEY.optionalSkillsWeight / total,
    experienceWeight: MODEL_KEY.experienceWeight / total,
  };
}


