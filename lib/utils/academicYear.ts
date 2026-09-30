// lib/utils/academicYear.ts
export function generateAcademicYears(): string[] {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11 (0=Jan, 5=Jun)
  const currentYear = currentDate.getFullYear();
  
  // Academic year typically starts in June/July
  // If current month is June (5) or later, we're in the year that started this year
  // If before June, we're still in the year that started last year
  let startYear = currentMonth >= 5 ? currentYear : currentYear - 1;
  
  const years: string[] = [];
  
  // Generate last 5 years, current year, and next 2 years (total 8 years)
  for (let i = -5; i <= 2; i++) {
    const year = startYear + i;
    const nextYear = year + 1;
    const yearString = `${year.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;
    years.push(yearString);
  }
  
  return years.reverse(); // Most recent first
}

export function getCurrentAcademicYear(): string {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentYear = currentDate.getFullYear();
  
  // If we're in June or later, academic year is currentYear-nextYear
  // If before June, academic year is lastYear-currentYear
  let startYear = currentMonth >= 5 ? currentYear : currentYear - 1;
  const nextYear = startYear + 1;
  
  return `${startYear.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;
}
