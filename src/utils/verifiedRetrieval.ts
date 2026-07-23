import { mfsReadJSON } from './mfs';
import { EncryptionUtils } from '@/encryption';
import { ResultLedgerContract } from './contractUtils';

export interface VerifiedResult {
  student: string;
  examId: string;
  score: number;
  totalQuestions: number;
  timestamp: number;
  ipfsCID: string;
  isUpdate: boolean;
  integrityVerified: boolean;
  version: number;
}

export interface ResultEntry {
  resultHash: string;
  ipfsCID: string;
  timestamp: string;
  submittedBy: string;
  isUpdate: boolean;
  score: string;
  totalQuestions: string;
  student?: string;
}

/**
 * SEC-TC-014 & SEC-TC-015: Verified Result Retrieval
 * 1. Fetches ALL result history for a student/exam from blockchain.
 * 2. Fetches IPFS content for each entry.
 * 3. Verifies IPFS content SHA-256 against on-chain anchored hash.
 * 4. Labels historical versions correctly.
 */
export async function getVerifiedStudentResults(
  studentAddr: string,
  examId: string
): Promise<VerifiedResult[]> {
  const contract = ResultLedgerContract();
  if (!contract) return [];

  const history = (await contract.methods.getResultHistory(studentAddr, examId).call()) as ResultEntry[];
  if (!history || history.length === 0) return [];

  const verifiedResults: VerifiedResult[] = [];

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const onChainHash = entry.resultHash;
    const ipfsCID = entry.ipfsCID;

    const payload = await mfsReadJSON<any>(ipfsCID);
    if (!payload) continue;

    // SEC-TC-075: Post-Decryption Identity Verification
    // Even if I have the CID, I MUST be the owner to view it.
    const decryptedPayload = EncryptionUtils.decryptAES(payload); // Assumes we got the key derivation correct
    const decoded = JSON.parse(decryptedPayload);
    
    const isOwner = decoded.studentWallet?.toLowerCase() === studentAddr.toLowerCase();
    
    // SEC-TC-061 & SEC-TC-062: Integrity check against on-chain hash
    const contentToHash = JSON.stringify(payload); // Raw CID content
    const calculatedHash = EncryptionUtils.hashSHA256(contentToHash);
    const integrityVerified = (calculatedHash === onChainHash);

    if (!isOwner) {
       console.error("IDENTITY MISMATCH: Result belongs to a different wallet address.");
       continue; // Skip unauthorized results (SEC-TC-075)
    }

    verifiedResults.push({
      student: entry.student || studentAddr,
      examId: examId,
      score: Number(entry.score),
      totalQuestions: Number(entry.totalQuestions),
      timestamp: Number(entry.timestamp),
      ipfsCID: ipfsCID,
      isUpdate: entry.isUpdate,
      integrityVerified: integrityVerified,
      version: i + 1
    });
  }

  // Reverse to show latest first (SEC-TC-015)
  return verifiedResults.reverse();
}
