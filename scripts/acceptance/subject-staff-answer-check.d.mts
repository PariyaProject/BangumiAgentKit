export type SubjectStaffRoleNamePair = {
  role: string;
  name: string;
};

export function countExplicitSubjectStaffPairs(
  answer: string,
  pairs: SubjectStaffRoleNamePair[],
): number;
