export type UserProfile = {
  handicap?: number;
  age?: number;
  handedness: 'left' | 'right';
  gender?: 'male' | 'female' | 'other';
  clubs?: string;
  clubYardages?: Record<string, number>;
};
