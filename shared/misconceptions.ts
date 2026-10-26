// Catalog of common student misconceptions. The Kreyòl lines are guidance for the model,
// not scripts: it adapts them to the student's actual numbers and level.

export const OPERATIONS = [
  "addition",
  "subtraction",
  "multiplication",
  "division",
  "fractions",
  "equations",
  "exponents",
  "other",
] as const;
export type Operation = (typeof OPERATIONS)[number];

export type Misconception = {
  id: string;
  operation: Operation;
  /** How to recognise it in the student's work (English, for the model). */
  signs: string;
  /** Natural Kreyòl wording for what the student did. */
  action_ht: string;
  /** The key idea to explain. */
  concept_ht: string;
  /** A concrete picture that is mathematically exact. */
  example_ht: string;
};

export const MISCONCEPTIONS: Misconception[] = [
  {
    id: "add_no_carry",
    operation: "addition",
    signs: "Writes the whole column sum (e.g. 15) instead of carrying the ten: 38 + 47 = 715.",
    action_ht: "Ou ekri tout total kolòn inite yo, san ou pa pote dizèn nan nan kolòn dizèn yo.",
    concept_ht: "Chak kolòn kenbe yon sèl chif. Lè total yon kolòn rive 10 oswa plis, nou pote dizèn nan nan kolòn ki agoch la.",
    example_ht: "10 grenn mango fè yon pakèt dis. Pakèt la ale nan kolòn dizèn yo, pa nan kolòn inite yo.",
  },
  {
    id: "add_place_value_misalign",
    operation: "addition",
    signs: "Digits not lined up by place value, so a number is added as if it were 10 or 100 times bigger.",
    action_ht: "Ou pa mete chif yo nan bon kolòn yo: inite anba inite, dizèn anba dizèn.",
    concept_ht: "Valè yon chif depann de kote li ye nan nonb lan. Nou aliyen inite yo ak inite yo anvan nou ajoute.",
    example_ht: "Nan 38, chif 3 a vo 30, li pa vo 300.",
  },
  {
    id: "sub_smaller_from_larger",
    operation: "subtraction",
    signs: "In each column subtracts the smaller digit from the larger one, whichever is on top: 52 - 27 = 35.",
    action_ht: "Nan chak kolòn, ou retire ti chif la nan gwo chif la, kèlkeswa kiyès ki anlè.",
    concept_ht: "Nou toujou retire chif ki anba a nan chif ki anlè a. Si chif anlè a twò piti, nou prete yon dizèn nan kolòn ki agoch la.",
    example_ht: "52 se 5 dizèn ak 2 inite. Nou ka chanje 1 dizèn pou 10 inite: sa ba nou 4 dizèn ak 12 inite.",
  },
  {
    id: "sub_borrow_not_reduced",
    operation: "subtraction",
    signs: "Borrows from a column (often across a zero) but does not reduce that column afterwards.",
    action_ht: "Ou prete nan kolòn ki agoch la, men apre sa ou pa diminye kolòn sa a.",
    concept_ht: "Lè nou prete yon dizèn oswa yon santèn, kolòn nou prete a pèdi 1.",
    example_ht: "403 se 4 santèn, 0 dizèn ak 3 inite. Si nou pran 1 santèn, se 3 santèn sèlman ki rete.",
  },
  {
    id: "mul_fact_error",
    operation: "multiplication",
    signs: "Right method, wrong multiplication fact: 7 × 8 = 54.",
    action_ht: "Ou konnen se yon miltiplikasyon pou fè, men rezilta a pa egzat.",
    concept_ht: "Miltipliye se repete yon gwoup egal plizyè fwa. Nou ka verifye yon rezilta lè nou konte gwoup yo.",
    example_ht: "3 × 4 se 3 gwoup ki gen 4 chak: 4 + 4 + 4.",
  },
  {
    id: "mul_added_instead",
    operation: "multiplication",
    signs: "Adds the two numbers instead of multiplying: 6 × 4 = 10.",
    action_ht: "Ou ajoute de nonb yo olye ou miltipliye yo.",
    concept_ht: "Siy × la mande nou repete yon gwoup egal plizyè fwa, pa mete de nonb yo ansanm yon sèl fwa.",
    example_ht: "2 × 5 vle di 2 gwoup ki gen 5 chak.",
  },
  {
    id: "div_reversed",
    operation: "division",
    signs: "Divides the larger number by the smaller one whatever their order: 3 ÷ 12 = 4.",
    action_ht: "Ou divize nonb yo nan lòd ki pa bon an.",
    concept_ht: "Nan yon divizyon, nonb ki anvan siy ÷ la se kantite n ap pataje a. Nonb ki apre a di an konbyen pati egal n ap pataje l.",
    example_ht: "Si n ap pataje 2 mango bay 8 moun, chak moun ap jwenn mwens pase yon mango antye.",
  },
  {
    id: "div_remainder_ignored",
    operation: "division",
    signs: "Gives only the whole quotient and drops what is left over: 17 ÷ 5 = 3.",
    action_ht: "Ou jwenn konbyen fwa nonb lan antre, men ou bliye sa ki rete a.",
    concept_ht: "Lè yon divizyon pa tonbe egal, gen yon rès: sa ki rete apre nou fin fè gwoup egal yo.",
    example_ht: "13 mango pou 4 moun: chak moun jwenn 3 mango, epi gen 1 mango ki rete.",
  },
  {
    id: "div_remainder_too_big",
    operation: "division",
    signs: "Remainder is equal to or larger than the divisor: 29 ÷ 4 = 6 rès 5.",
    action_ht: "Rès ou jwenn nan pa pi piti pase nonb w ap divize pa li a.",
    concept_ht: "Rès la dwe toujou pi piti pase divizè a. Si li pa pi piti, nou ka fè yon lòt gwoup ankò.",
    example_ht: "Si gen 5 mango ki rete pou 4 moun, nou ka bay chak moun yon lòt mango ankò.",
  },
  {
    id: "frac_add_across",
    operation: "fractions",
    signs: "Adds numerators together and denominators together: 1/2 + 1/3 = 2/5.",
    action_ht: "Ou ajoute nimewo ki anlè fraksyon yo ansanm, epi ou ajoute nimewo ki anba yo ansanm tou.",
    concept_ht:
      "Denominatè a se nimewo ki anba liy fraksyon an. Li montre an konbyen pati egal nou koupe yon antye. Pou n ajoute fraksyon, pati yo dwe menm gwosè: fraksyon yo dwe gen menm denominatè.",
    example_ht: "Mwatye yon gato ak yon tyè menm gato a pa menm gwosè moso. Nou pa ka jis konte yo tankou de moso parèy.",
  },
  {
    id: "frac_div_not_inverted",
    operation: "fractions",
    signs: "Multiplies (or divides straight across) instead of dividing by the fraction: 1/2 ÷ 1/4 = 1/8.",
    action_ht: "Ou miltipliye de fraksyon yo olye ou divize premye a pa dezyèm nan.",
    concept_ht: "Divize pa yon fraksyon vle di chèche konbyen fwa fraksyon sa a antre nan premye a.",
    example_ht: "Konbyen mwatye pen ki antre nan yon pen antye?",
  },
  {
    id: "eq_inverse_operation_wrong",
    operation: "equations",
    signs: "Uses the same operation instead of the inverse one to move a term: 2x + 3 = 11 -> 2x = 14.",
    action_ht: "Pou deplase nonb lan, ou fè menm operasyon an olye ou fè operasyon ki defèt li a.",
    concept_ht: "Yon ekwasyon se tankou yon balans: sa ki agoch egal sa ki adwat. Pou retire yon nonb ki te ajoute, nou retire l sou tou de bò yo.",
    example_ht: "Si yon bò balans lan gen 3 kilo an plis, nou retire 3 kilo sou chak bò pou l rete an ekilib.",
  },
  {
    id: "eq_divide_wrong",
    operation: "equations",
    signs: "Multiplies instead of dividing to isolate the unknown: 3x = 12 -> x = 36.",
    action_ht: "Ou miltipliye olye ou divize pou jwenn valè enkoni an.",
    concept_ht: "3x vle di 3 fwa x. Pou jwenn x, nou divize tou de bò yo pa menm nonb lan.",
    example_ht: "Si 3 sache menm pwa peze 6 kilo, chak sache peze 6 divize pa 3.",
  },
  {
    id: "eq_one_side_only",
    operation: "equations",
    signs: "Changes only one side of the equation.",
    action_ht: "Ou chanje yon sèl bò ekwasyon an.",
    concept_ht: "Balans lan rete egal sèlman si nou fè menm bagay la sou tou de bò yo.",
    example_ht: "Si nou ajoute yon wòch sou yon sèl bò balans lan, li panche.",
  },
  {
    id: "exp_multiply_base_by_exponent",
    operation: "exponents",
    signs: "Multiplies the base by the exponent: 2^3 = 6.",
    action_ht: "Ou miltipliye baz la pa ekspozan an.",
    concept_ht: "Ekspozan an di konbyen fwa nou miltipliye baz la pa li menm.",
    example_ht: "5² vle di 5 × 5, se pa 5 × 2.",
  },
];

/** Extra labels the model may use besides the catalog ids. */
export const SPECIAL_IDS = ["none", "other", "insufficient_evidence"] as const;
export const MISCONCEPTION_IDS = [...MISCONCEPTIONS.map((m) => m.id), ...SPECIAL_IDS];

export const findMisconception = (id: string) => MISCONCEPTIONS.find((m) => m.id === id);
