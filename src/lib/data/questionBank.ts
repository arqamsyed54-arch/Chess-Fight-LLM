import type { Difficulty, Question } from './types';

export const QUESTION_TYPES = [
  'MCQ',
  'Fill in the Blank',
  'True/False',
  'Short Answer',
  'Long Answer',
  'Match the Following',
  'Assertion-Reason',
  'Case Study',
  'Numerical',
  'Diagram-based',
  'Custom',
] as const;

export const DIFFICULTIES: Difficulty[] = [
  'Easy',
  'Medium',
  'Average',
  'Moderate',
  'Hard',
  'Extra Hard',
];

export const PURPOSES = ['Practice', 'Exam', 'National-level'] as const;

export const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'History',
  'Geography',
  'Economics',
  'Computer Science',
  'Accountancy',
  'Business Studies',
  'Political Science',
  'Psychology',
  'Sociology',
  'Environmental Science',
  'Physical Education',
];

export const TOPICS: Record<string, string[]> = {
  Mathematics: ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Trigonometry'],
  Physics: ['Mechanics', 'Optics', 'Electricity', 'Thermodynamics', 'Waves'],
  Chemistry: ['Organic', 'Inorganic', 'Physical', 'Equilibrium', 'Bonding'],
  Biology: ['Cell Biology', 'Genetics', 'Ecology', 'Human Physiology', 'Evolution'],
  English: ['Grammar', 'Comprehension', 'Writing', 'Literature'],
  History: ['Ancient', 'Medieval', 'Modern', 'Freedom Struggle', 'World Wars'],
  Geography: ['Physical', 'Human', 'Climate', 'Population', 'Maps'],
  Economics: ['Microeconomics', 'Macroeconomics', 'Development', 'Monetary Policy', 'Trade'],
  'Computer Science': ['Programming', 'Databases', 'Algorithms', 'Data Structures', 'Networks'],
};

const q = (
  id: string,
  subject: string,
  topic: string,
  difficulty: Difficulty,
  type: string,
  text: string,
  answer: string,
  solution: string,
  marks = 1,
): Question => ({ id, subject, topic, difficulty, type, text, answer, solution, marks });

export const QUESTION_BANK: Question[] = [
  // Mathematics
  q('M1', 'Mathematics', 'Algebra', 'Easy', 'MCQ', 'What is the value of 7 × 8?', '56', '7×8 = 56 from the multiplication table.', 1),
  q('M2', 'Mathematics', 'Algebra', 'Medium', 'MCQ', 'Solve for x: 2x + 6 = 20', 'x = 7', 'Subtract 6 from both sides: 2x = 14. Divide by 2: x = 7.', 2),
  q('M3', 'Mathematics', 'Algebra', 'Hard', 'Long Answer', 'Factorize the polynomial x² − 5x + 6.', '(x − 2)(x − 3)', 'Find two numbers that multiply to 6 and add to −5: −2 and −3. So (x − 2)(x − 3).', 3),
  q('M4', 'Mathematics', 'Calculus', 'Moderate', 'Numerical', 'Find the derivative of x³ with respect to x.', '3x²', 'Power rule: d/dx(xⁿ) = nxⁿ⁻¹, so d/dx(x³) = 3x².', 2),
  q('M5', 'Mathematics', 'Geometry', 'Easy', 'True/False', 'The sum of the interior angles of a triangle is 180°.', 'True', 'Standard Euclidean theorem.', 1),
  q('M6', 'Mathematics', 'Statistics', 'Medium', 'Short Answer', 'How is the arithmetic mean of a data set computed?', 'Sum the values and divide by the count of values.', 'Mean = (Σx)/n.', 2),
  q('M7', 'Mathematics', 'Calculus', 'Extra Hard', 'Long Answer', 'Evaluate the definite integral ∫₀¹ x² dx.', '1/3', 'Anti-derivative of x² is x³/3. Applying limits: (1/3 − 0) = 1/3.', 4),
  q('M8', 'Mathematics', 'Trigonometry', 'Medium', 'MCQ', 'What is the value of sin 30°?', '1/2', 'From the standard angle table, sin 30° = 1/2.', 1),
  q('M9', 'Mathematics', 'Algebra', 'Moderate', 'Fill in the Blank', 'Expanding (a + b)² gives a² + ____ + b².', '2ab', '(a + b)² = a² + 2ab + b².', 1),
  q('M10', 'Mathematics', 'Algebra', 'Medium', 'Assertion-Reason', 'Assertion: x = −2 satisfies 3x + 6 = 0. Reason: A linear equation has exactly one root.', 'Both true; Reason is the correct explanation.', '3(−2) + 6 = 0 holds; linear equations have one root.', 2),

  // Physics
  q('P1', 'Physics', 'Mechanics', 'Easy', 'MCQ', 'Which of the following is a vector quantity?', 'Velocity', 'Velocity has both magnitude and direction; the rest here are scalars.', 1),
  q('P2', 'Physics', 'Mechanics', 'Medium', 'Long Answer', 'State and explain Newton’s Second Law of motion.', 'F = ma. The net force on a body equals mass × acceleration, where force is proportional to the rate of change of momentum.', 'Momentum p = mv; F = dp/dt = m·dv/dt = ma when mass is constant.', 3),
  q('P3', 'Physics', 'Optics', 'Easy', 'True/False', 'Light travels faster in water than in air.', 'False', 'Water has a higher refractive index, so the speed of light is lower.', 1),
  q('P4', 'Physics', 'Electricity', 'Hard', 'Numerical', 'A 12 V battery pushes a current of 3 A through a resistor. Find its resistance.', '4 Ω', 'Ohm’s law: R = V/I = 12 V / 3 A = 4 Ω.', 2),
  q('P5', 'Physics', 'Thermodynamics', 'Medium', 'Short Answer', 'State the First Law of Thermodynamics.', 'ΔU = Q − W (heat added to a system equals change in internal energy plus work done by it).', 'It is a statement of energy conservation for thermodynamic systems.', 2),
  q('P6', 'Physics', 'Waves', 'Moderate', 'Fill in the Blank', 'The SI unit of frequency is the ____.', 'hertz (Hz)', 'Frequency is the number of cycles per second, measured in hertz.', 1),
  q('P7', 'Physics', 'Mechanics', 'Extra Hard', 'Long Answer', 'A 2 kg body moving at 5 m/s collides elastically with a stationary 3 kg body. Find the final velocities.', 'v₁ = −1 m/s, v₂ = 4 m/s', 'Conserve momentum: 10 = 2v₁ + 3v₂. Conserve KE: 25 = 2v₁² + 3v₂². Solve: v₁ = (m₁−m₂)u₁/(m₁+m₂) = −1, v₂ = 2m₁u₁/(m₁+m₂) = 4.', 4),

  // Chemistry
  q('C1', 'Chemistry', 'Bonding', 'Easy', 'MCQ', 'What type of bond forms between sodium atoms and chlorine atoms?', 'Ionic bond', 'Na loses one electron to Cl, forming Na⁺ and Cl⁻ which attract electrostatically.', 1),
  q('C2', 'Chemistry', 'Organic', 'Medium', 'Fill in the Blank', 'The chemical formula of methane is ____.', 'CH₄', 'One carbon bonded to four hydrogens.', 1),
  q('C3', 'Chemistry', 'Equilibrium', 'Hard', 'Short Answer', 'State Le Chatelier’s principle.', 'If an equilibrium system is disturbed, it shifts toward the direction that minimizes the disturbance.', 'Stressors include concentration, pressure and temperature changes.', 3),
  q('C4', 'Chemistry', 'Inorganic', 'Easy', 'True/False', 'Pure water is a good conductor of electricity.', 'False', 'Pure water barely conducts; dissolved ions are what carry current.', 1),
  q('C5', 'Chemistry', 'Physical', 'Moderate', 'MCQ', 'What is the pH of a neutral solution at 25°C?', '7', 'At 25°C, [H⁺] = [OH⁻] = 10⁻⁷ M gives pH = 7.', 1),
  q('C6', 'Chemistry', 'Organic', 'Extra Hard', 'Long Answer', 'Distinguish between alkanes and alkenes in structure and reactivity.', 'Alkanes have only single C–C bonds and react via substitution; alkenes contain a C=C double bond that undergoes addition reactions.', 'Formula CₙH₂ₙ₊₂ vs CₙH₂ₙ; bromine water decolorizes with alkenes only.', 4),

  // Biology
  q('B1', 'Biology', 'Cell Biology', 'Easy', 'MCQ', 'Which organelle is the powerhouse of the cell?', 'Mitochondria', 'Mitochondria convert glucose energy into ATP.', 1),
  q('B2', 'Biology', 'Genetics', 'Medium', 'Short Answer', 'Define gene', 'segment of DNA coding for a trait.', 'Genes are units of heredity carried on chromosomes.', 2),
  q('B3', 'Biology', 'Human Physiology', 'Medium', 'True/False', 'The human heart has four chambers.', 'True', 'Two atria and two ventricles.', 1),
  q('B4', 'Biology', 'Ecology', 'Easy', 'Fill in the Blank', 'The study of interactions in ecosystems is called ____.', 'ecology', 'Ecology studies organisms and their environment.', 1),
  q('B5', 'Biology', 'Genetics', 'Moderate', 'Case Study', 'In peas, round seeds (R) are dominant over wrinkled (r). Two Rr plants are crossed. What fraction of the offspring show round seeds?', '3/4 or 75%', 'Punnett square gives RR, Rr, Rr, rr — three of four carry at least one R.', 3),
  q('B6', 'Biology', 'Evolution', 'Hard', 'Long Answer', 'Explain natural selection with an example.', 'Individuals with advantageous traits survive and reproduce more, so the trait spreads across generations.', 'Example: giraffe necks lengthened as longer necks reached higher foliage and survived better.', 5),

  // Computer Science
  q('CS1', 'Computer Science', 'Programming', 'Easy', 'MCQ', 'Which of these is a conditional statement in C?', 'if', 'if/else and switch implement decisions.', 1),
  q('CS2', 'Computer Science', 'Databases', 'Medium', 'Short Answer', 'What is SQL injection?', 'Splicing malicious SQL into a query by exploiting unvalidated user input.', 'Prevent with parameterized queries or prepared statements.', 2),
  q('CS3', 'Computer Science', 'Data Structures', 'Hard', 'MCQ', 'The worst-case time complexity of binary search is:', 'O(log n)', 'Each step halves the search space.', 1),
  q('CS4', 'Computer Science', 'Algorithms', 'Moderate', 'Fill in the Blank', 'The average complexity of bubble sort is ____.', 'O(n²)', 'Bubble sort compares adjacent pairs in about n² cycles total.', 1),
  q('CS5', 'Computer Science', 'Databases', 'Extra Hard', 'Long Answer', 'Explain the ACID properties of database transactions.', 'Atomicity, Consistency, Isolation, Durability make transactions reliable even on failures.', 'Each property guards against partial writes or corrupted states during concurrent operations.', 4),
  q('CS6', 'Computer Science', 'Programming', 'Easy', 'True/False', 'JavaScript can run directly inside the browser.', 'True', 'Browsers embed JS engines like V8.', 1),
  q('CS7', 'Computer Science', 'Programming', 'Medium', 'Case Study', 'An e-commerce cart stores items in a JS array. Adding an item every second degrades checks slowly. Suggest an approach.', 'Prefer hash-map keyed lookup (object/Map) for frequent queries.', 'Growth of an array fill often shifts balance; tree map helps.', 3),

  // History
  q('H1', 'History', 'Ancient', 'Easy', 'MCQ', 'Which is among the world’s earliest known civilizations?', 'Indus Valley', 'It flourished in the Bronze Age.', 1),
  q('H2', 'History', 'Freedom Struggle', 'Medium', 'Long Answer', 'Why did the Non-Cooperation Movement (1920–22) gain wide support?', 'It united diverse groups — students, peasants, workers and professionals — around a common cause of boycotting British institutions and goods.', 'Gandhi linked the Khilafat and Swaraj issues; people across regions participated, making it the first truly mass movement.', 5),
  q('H3', 'History', 'World Wars', 'Hard', 'Short Answer', 'Explain the Cuban Missile Cold War event.', '1962 confrontation (US vs USSR) over missiles in Cuba, closest to nuclear war.', 'US blockade led to USSR removing missiles for a promise not to invade Cuba.', 3),
  q('H4', 'History', 'Freedom Struggle', 'Easy', 'True/False', 'The Quit India Movement began in 1942.', 'True', 'Launched in August 1942.', 1),
  q('H5', 'History', 'Medieval', 'Moderate', 'Fill in the Blank', 'The Mughal emperor who built the Taj Mahal was ____.', 'Shah Jahan', 'Built for Mumtaz Mahal.', 1),
];

export interface QuestionFilters {
  subject?: string;
  topic?: string;
  difficulty?: string;
  type?: string;
  query?: string;
}

export function searchQuestions(filters: QuestionFilters): Question[] {
  const q0 = (filters.query || '').trim().toLowerCase();
  return QUESTION_BANK.filter((question) => {
    if (filters.subject && question.subject !== filters.subject) return false;
    if (filters.topic && question.topic !== filters.topic) return false;
    if (filters.difficulty && question.difficulty !== filters.difficulty) return false;
    if (filters.type && question.type !== filters.type) return false;
    if (q0) {
      const haystack = `${question.text} ${question.topic} ${question.subject}`.toLowerCase();
      if (!haystack.includes(q0)) return false;
    }
    return true;
  });
}

export function topicsFor(subject: string): string[] {
  return TOPICS[subject] || [];
}