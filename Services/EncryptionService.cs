using System.Security.Cryptography;
using System.Text;

namespace BluesoundWeb.Services;

/// <summary>
/// Service for encrypting and decrypting sensitive data using AES-256
/// </summary>
public interface IEncryptionService
{
    /// <summary>
    /// Encrypts a plaintext string using AES-256
    /// </summary>
    string Encrypt(string plainText);

    /// <summary>
    /// Decrypts an encrypted string
    /// </summary>
    string Decrypt(string encryptedText);
}

public class EncryptionService : IEncryptionService
{
    private readonly byte[] _key;
    private readonly byte[] _iv;

    public EncryptionService(IConfiguration configuration)
    {
        // Get encryption key from configuration or generate a machine-specific one
        var configKey = configuration["Encryption:Key"];

        if (string.IsNullOrEmpty(configKey))
        {
            // Use a machine-specific key derived from machine name and a fixed salt
            // This ensures the key is consistent across app restarts on the same machine
            var machineIdentifier = Environment.MachineName + "-BluesoundWeb-ApiKeys";
            _key = DeriveKey(machineIdentifier, 32); // 256 bits
            _iv = DeriveKey(machineIdentifier + "-IV", 16); // 128 bits
        }
        else
        {
            // Use configured key
            _key = DeriveKey(configKey, 32);
            _iv = DeriveKey(configKey + "-IV", 16);
        }
    }

    private static byte[] DeriveKey(string input, int length)
    {
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));

        if (length <= hash.Length)
        {
            return hash.Take(length).ToArray();
        }

        // If we need more bytes, hash again
        var result = new byte[length];
        Array.Copy(hash, result, hash.Length);
        return result;
    }

    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText))
            return string.Empty;

        using var aes = Aes.Create();
        aes.Key = _key;
        aes.IV = _iv;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;

        using var encryptor = aes.CreateEncryptor();
        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var encryptedBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

        return Convert.ToBase64String(encryptedBytes);
    }

    public string Decrypt(string encryptedText)
    {
        if (string.IsNullOrEmpty(encryptedText))
            return string.Empty;

        try
        {
            using var aes = Aes.Create();
            aes.Key = _key;
            aes.IV = _iv;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var decryptor = aes.CreateDecryptor();
            var encryptedBytes = Convert.FromBase64String(encryptedText);
            var decryptedBytes = decryptor.TransformFinalBlock(encryptedBytes, 0, encryptedBytes.Length);

            return Encoding.UTF8.GetString(decryptedBytes);
        }
        catch (Exception)
        {
            // Return empty if decryption fails (corrupted data, wrong key, etc.)
            return string.Empty;
        }
    }
}
