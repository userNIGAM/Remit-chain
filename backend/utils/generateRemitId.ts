const generateRemitId = (): string => {
  // Generate a random 5-digit number
  const number = Math.floor(10000 + Math.random() * 90000);

  // Example:
  // NP-48291
  return `NP-${number}`;
};

export default generateRemitId;
