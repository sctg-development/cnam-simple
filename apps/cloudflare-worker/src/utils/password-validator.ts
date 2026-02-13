/**
 * MIT License
 *
 * Copyright (c) 2024-2026 Ronan LE MEILLAT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { sha512crypt } from "sha512crypt-node";

/**
 * Password Validation: Cryptographic Hash Verification
 * SHA512-crypt comparison for secure credential validation
 * Uses salted hashing to prevent rainbow table attacks
 *
 * Generated with: openssl passwd -6 <password>
 *
 * @param plainPassword - Plain text password to validate
 * @param hash - SHA512-crypt hash from environment (e.g., $6$...)
 * @returns true if password matches hash, false otherwise
 */
export function validateScraperPassword(
  plainPassword: string,
  hash: string,
): boolean {
  try {
    // Validate that we have both inputs
    if (!plainPassword || !hash) {
      console.warn("[Auth] Missing password or hash for validation");

      return false;
    }

    // Extract salt from hash (SHA512-crypt format: $6$salt$hash)
    // Salt Extraction Pattern: Parse hash structure to recover original salt
    const hashParts = hash.split("$");

    if (hashParts.length < 4 || hashParts[1] !== "6") {
      console.warn("[Auth] Invalid SHA512-crypt hash format");

      return false;
    }

    const salt = hashParts[2]; // Extract salt: $6$salt$hash

    // Cryptographic Comparison: HMAC-style verification against stored hash
    // Uses salt from original hash to ensure deterministic hashing
    const hashedPassword = sha512crypt(plainPassword, "$6$" + salt);

    // Compare the generated hash with the stored hash
    const isValid = hashedPassword === hash;

    if (isValid) {
      console.log("[Auth] Password validation successful");
    } else {
      console.warn("[Auth] Password validation failed - invalid password");
    }

    return isValid;
  } catch (error) {
    console.error("[Auth] Error during password validation:", error);

    return false;
  }
}
