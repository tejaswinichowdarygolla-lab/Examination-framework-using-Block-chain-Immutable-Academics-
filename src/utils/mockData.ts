export type Role = 'student' | 'instructor' | 'admin';

export interface User {
  did: string;
  address: string;
  role: Role;
  name: string;
  registrationBlock: number;
  lastActive: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  instructorDid: string;
  instructorName: string;
  studentCount: number;
  examCount: number;
  enrolledStudents: string[];
  lastActivity: string;
  txHash: string;
}

export interface Exam {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  status: 'upcoming' | 'live' | 'closed';
  startTime: string;
  endTime: string;
  duration: number;
  questionCount: number;
  ipfsCid: string;
  txHash: string;
  submissionCount: number;
  totalStudents: number;
  questions?: ExamQuestion[];
}

export interface ExamQuestion {
  id: number;
  text: string;
  type: 'mcq' | 'true-false';
  options: string[];
  correctAnswer: number;
  points: number;
}

export interface Submission {
  id: string;
  studentDid: string;
  studentName: string;
  examId: string;
  examName: string;
  courseName: string;
  submissionTime: string;
  ipfsCid: string;
  txHash: string;
  zkProofStatus: 'verified' | 'pending' | 'invalid';
  gradeCommitment: string;
  grade?: number;
  blockNumber: number;
}

export interface GasDataPoint {
  date: string;
  chainedu: number;
  ethereum: number;
}

export interface BlockchainEvent {
  id: string;
  type: 'ExamPublished' | 'AnswerSubmitted' | 'ProofVerified' | 'GradeCommitted' | 'CourseCreated' | 'DIDRegistered';
  actorDid: string;
  details: string;
  blockNumber: number;
  txHash: string;
  timestamp: string;
}

// Mock users
export const mockUsers: User[] = [
  { did: 'did:ethr:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38', role: 'student', name: 'Alice Chen', registrationBlock: 14523100, lastActive: '2024-01-15T10:30:00Z' },
  { did: 'did:ethr:0x8Ba1f109551bD432803012645Ac136ddd64DBA72', address: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72', role: 'student', name: 'Bob Martinez', registrationBlock: 14523150, lastActive: '2024-01-15T09:45:00Z' },
  { did: 'did:ethr:0x2546BcD3c84621e976D8185a91A922aE77ECEc30', address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', role: 'student', name: 'Carol Williams', registrationBlock: 14523200, lastActive: '2024-01-14T16:20:00Z' },
  { did: 'did:ethr:0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', address: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', role: 'student', name: 'David Kim', registrationBlock: 14523250, lastActive: '2024-01-15T11:00:00Z' },
  { did: 'did:ethr:0xdD2FD4581271e230360230F9337D5c0430Bf44C0', address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', role: 'student', name: 'Eva Rossi', registrationBlock: 14523300, lastActive: '2024-01-15T08:15:00Z' },
  { did: 'did:ethr:0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', address: '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', role: 'student', name: 'Frank Dubois', registrationBlock: 14523350, lastActive: '2024-01-14T14:30:00Z' },
  { did: 'did:ethr:0x71C7656EC7ab88b098defB751B7401B5f6d8976F', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', role: 'student', name: 'Grace Tanaka', registrationBlock: 14523400, lastActive: '2024-01-15T12:45:00Z' },
  { did: 'did:ethr:0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', address: '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', role: 'student', name: 'Hassan Ahmed', registrationBlock: 14523450, lastActive: '2024-01-13T10:00:00Z' },
  { did: 'did:ethr:0x1aE0EA34a72D944a8C7603FfB3eC30a6669E454C', address: '0x1aE0EA34a72D944a8C7603FfB3eC30a6669E454C', role: 'student', name: 'Iris Novak', registrationBlock: 14523500, lastActive: '2024-01-15T07:30:00Z' },
  { did: 'did:ethr:0x53d284357ec70cE289D6D64134DfAc8E511c8a3D', address: '0x53d284357ec70cE289D6D64134DfAc8E511c8a3D', role: 'student', name: 'Jake Thompson', registrationBlock: 14523550, lastActive: '2024-01-14T18:00:00Z' },
  { did: 'did:ethr:0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', role: 'instructor', name: 'Dr. Sarah Johnson', registrationBlock: 14522800, lastActive: '2024-01-15T13:00:00Z' },
  { did: 'did:ethr:0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c', address: '0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c', role: 'instructor', name: 'Prof. Michael Lee', registrationBlock: 14522850, lastActive: '2024-01-15T11:30:00Z' },
  { did: 'did:ethr:0x14723A09ACff6D2A60DcdF7aA4AFf308FDDC160C', address: '0x14723A09ACff6D2A60DcdF7aA4AFf308FDDC160C', role: 'instructor', name: 'Dr. Emily Zhang', registrationBlock: 14522900, lastActive: '2024-01-14T15:45:00Z' },
  { did: 'did:ethr:0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB', address: '0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB', role: 'admin', name: 'Admin Root', registrationBlock: 14522700, lastActive: '2024-01-15T14:00:00Z' },
];

export const mockCourses: Course[] = [
  {
    id: 'course-1', name: 'Blockchain Fundamentals', code: 'CS401',
    description: 'Introduction to distributed ledger technology, consensus mechanisms, and smart contracts.',
    instructorDid: 'did:ethr:0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', instructorName: 'Dr. Sarah Johnson',
    studentCount: 30, examCount: 3, enrolledStudents: mockUsers.filter(u => u.role === 'student').slice(0, 8).map(u => u.did),
    lastActivity: '2024-01-15T10:00:00Z', txHash: '0x7a8f3c1d2e4b5f6a7890bcdef1234567890abcdef1234567890abcdef12345678',
  },
  {
    id: 'course-2', name: 'Zero-Knowledge Proofs', code: 'CS502',
    description: 'Advanced study of ZK-SNARKs, ZK-STARKs, and privacy-preserving computation.',
    instructorDid: 'did:ethr:0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', instructorName: 'Dr. Sarah Johnson',
    studentCount: 22, examCount: 2, enrolledStudents: mockUsers.filter(u => u.role === 'student').slice(0, 6).map(u => u.did),
    lastActivity: '2024-01-14T14:30:00Z', txHash: '0x3b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
  },
  {
    id: 'course-3', name: 'Decentralized Identity', code: 'CS450',
    description: 'Self-sovereign identity, DIDs, verifiable credentials, and decentralized PKI.',
    instructorDid: 'did:ethr:0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c', instructorName: 'Prof. Michael Lee',
    studentCount: 18, examCount: 2, enrolledStudents: mockUsers.filter(u => u.role === 'student').slice(2, 8).map(u => u.did),
    lastActivity: '2024-01-13T09:15:00Z', txHash: '0x9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d',
  },
  {
    id: 'course-4', name: 'Smart Contract Security', code: 'CS510',
    description: 'Auditing, formal verification, and security patterns for Solidity smart contracts.',
    instructorDid: 'did:ethr:0x14723A09ACff6D2A60DcdF7aA4AFf308FDDC160C', instructorName: 'Dr. Emily Zhang',
    studentCount: 25, examCount: 1, enrolledStudents: mockUsers.filter(u => u.role === 'student').slice(0, 10).map(u => u.did),
    lastActivity: '2024-01-15T12:00:00Z', txHash: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  },
];

const examQuestions: ExamQuestion[] = [
  { id: 1, text: 'What consensus mechanism does Polygon zkEVM use for transaction finality?', type: 'mcq', options: ['Proof of Work', 'Proof of Stake', 'ZK-Rollup with validity proofs', 'Optimistic Rollup'], correctAnswer: 2, points: 10 },
  { id: 2, text: 'In a ZK-SNARK, what does the "S" stand for?', type: 'mcq', options: ['Secure', 'Succinct', 'Sequential', 'Symmetric'], correctAnswer: 1, points: 10 },
  { id: 3, text: 'Which hash function is commonly used in ZK circuits for Ethereum compatibility?', type: 'mcq', options: ['SHA-256', 'Keccak-256', 'Poseidon', 'Blake2b'], correctAnswer: 2, points: 10 },
  { id: 4, text: 'IPFS uses content-addressing, meaning files are identified by their hash.', type: 'true-false', options: ['True', 'False'], correctAnswer: 0, points: 5 },
  { id: 5, text: 'What is the primary advantage of ZK proofs in an exam system?', type: 'mcq', options: ['Faster grading', 'Privacy-preserving verification', 'Cheaper storage', 'Better UI'], correctAnswer: 1, points: 10 },
  { id: 6, text: 'A DID (Decentralized Identifier) requires a centralized registry to function.', type: 'true-false', options: ['True', 'False'], correctAnswer: 1, points: 5 },
  { id: 7, text: 'Which encryption standard is recommended for encrypting exam answers before IPFS upload?', type: 'mcq', options: ['DES', 'AES-256', 'RSA-1024', 'ROT13'], correctAnswer: 1, points: 10 },
  { id: 8, text: 'What does CID stand for in IPFS?', type: 'mcq', options: ['Centralized ID', 'Content Identifier', 'Crypto ID', 'Chain ID'], correctAnswer: 1, points: 10 },
  { id: 9, text: 'Polygon zkEVM is EVM-equivalent, meaning existing Solidity contracts can run without modification.', type: 'true-false', options: ['True', 'False'], correctAnswer: 0, points: 5 },
  { id: 10, text: 'What is the gas cost advantage of Polygon zkEVM compared to Ethereum mainnet?', type: 'mcq', options: ['10x cheaper', '50x cheaper', '95%+ cheaper', 'Same cost'], correctAnswer: 2, points: 10 },
];

export const mockExams: Exam[] = [
  {
    id: 'exam-1', name: 'Midterm: Consensus & Scalability', courseId: 'course-1', courseName: 'Blockchain Fundamentals',
    status: 'upcoming', startTime: '2024-01-20T14:00:00Z', endTime: '2024-01-20T16:00:00Z', duration: 120,
    questionCount: 10, ipfsCid: 'QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX', txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef12345678',
    submissionCount: 0, totalStudents: 30, questions: examQuestions,
  },
  {
    id: 'exam-2', name: 'Quiz: ZK Circuit Design', courseId: 'course-2', courseName: 'Zero-Knowledge Proofs',
    status: 'live', startTime: '2024-01-15T09:00:00Z', endTime: '2024-01-15T17:00:00Z', duration: 60,
    questionCount: 10, ipfsCid: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', txHash: '0xdef789abc012345678901234567890abcdef1234567890abcdef1234567890abcd',
    submissionCount: 14, totalStudents: 22, questions: examQuestions,
  },
  {
    id: 'exam-3', name: 'Final: DID Architecture', courseId: 'course-3', courseName: 'Decentralized Identity',
    status: 'closed', startTime: '2024-01-10T10:00:00Z', endTime: '2024-01-10T12:00:00Z', duration: 120,
    questionCount: 10, ipfsCid: 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB', txHash: '0x456def789012345678901234567890abcdef1234567890abcdef1234567890abcd',
    submissionCount: 18, totalStudents: 18, questions: examQuestions,
  },
];

export const mockSubmissions: Submission[] = Array.from({ length: 15 }, (_, i) => ({
  id: `sub-${i + 1}`,
  studentDid: mockUsers.filter(u => u.role === 'student')[i % 10].did,
  studentName: mockUsers.filter(u => u.role === 'student')[i % 10].name,
  examId: i < 5 ? 'exam-3' : i < 10 ? 'exam-2' : 'exam-1',
  examName: i < 5 ? 'Final: DID Architecture' : i < 10 ? 'Quiz: ZK Circuit Design' : 'Midterm: Consensus & Scalability',
  courseName: i < 5 ? 'Decentralized Identity' : i < 10 ? 'Zero-Knowledge Proofs' : 'Blockchain Fundamentals',
  submissionTime: new Date(2024, 0, 10 + Math.floor(i / 5), 10 + (i % 3), i * 4).toISOString(),
  ipfsCid: `QmX${String.fromCharCode(97 + i)}Y${String.fromCharCode(65 + i)}PJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPb`,
  txHash: `0x${Array.from({ length: 64 }, (_, j) => '0123456789abcdef'[(i * 7 + j * 3) % 16]).join('')}`,
  zkProofStatus: i % 5 === 4 ? 'pending' : i % 7 === 6 ? 'invalid' : 'verified',
  gradeCommitment: `0x${Array.from({ length: 64 }, (_, j) => '0123456789abcdef'[(i * 11 + j * 5) % 16]).join('')}`,
  grade: i % 5 === 4 ? undefined : 60 + Math.floor(Math.random() * 40),
  blockNumber: 14523500 + i * 12,
}));

export const mockGasData: GasDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: `Jan ${i + 1}`,
  chainedu: 0.0001 + Math.random() * 0.0005,
  ethereum: 0.05 + Math.random() * 0.15,
}));

export const mockBlockchainEvents: BlockchainEvent[] = [
  { id: 'evt-1', type: 'CourseCreated', actorDid: 'did:ethr:0xAb58...eC9B', details: 'Course CS401 deployed', blockNumber: 14523100, txHash: '0x7a8f3c1d2e4b5f6a7890bcdef1234567890abcdef1234567890abcdef12345678', timestamp: '2024-01-10T08:00:00Z' },
  { id: 'evt-2', type: 'ExamPublished', actorDid: 'did:ethr:0xAb58...eC9B', details: 'Midterm published to IPFS', blockNumber: 14523200, txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef12345678', timestamp: '2024-01-12T14:00:00Z' },
  { id: 'evt-3', type: 'AnswerSubmitted', actorDid: 'did:ethr:0x742d...bD38', details: 'Exam submission encrypted', blockNumber: 14523400, txHash: '0xdef789abc012345678901234567890abcdef1234567890abcdef1234567890abcd', timestamp: '2024-01-14T10:30:00Z' },
  { id: 'evt-4', type: 'ProofVerified', actorDid: 'did:ethr:0x742d...bD38', details: 'ZK proof verified on-chain', blockNumber: 14523410, txHash: '0x111222333444555666777888999aaabbbcccdddeeefffaaabbb111222333444555', timestamp: '2024-01-14T10:31:00Z' },
  { id: 'evt-5', type: 'GradeCommitted', actorDid: 'did:ethr:0xAb58...eC9B', details: 'Grade hash committed', blockNumber: 14523500, txHash: '0xaaa111bbb222ccc333ddd444eee555fff666777888999000aaabbbcccdddeee111', timestamp: '2024-01-15T09:00:00Z' },
  { id: 'evt-6', type: 'DIDRegistered', actorDid: 'did:ethr:0x8Ba1...BA72', details: 'New student DID registered', blockNumber: 14523150, txHash: '0x999888777666555444333222111000fffeeeddccbbaa99887766554433221100ff', timestamp: '2024-01-11T11:00:00Z' },
];

export const gasOperationBreakdown = [
  { operation: 'Course Creation', chainEdu: 0.0012, ethereum: 0.24, savings: '99.5%' },
  { operation: 'Exam Publication', chainEdu: 0.0008, ethereum: 0.18, savings: '99.6%' },
  { operation: 'Answer Submission', chainEdu: 0.0003, ethereum: 0.08, savings: '99.6%' },
  { operation: 'Grade Commitment', chainEdu: 0.0002, ethereum: 0.05, savings: '99.6%' },
];
