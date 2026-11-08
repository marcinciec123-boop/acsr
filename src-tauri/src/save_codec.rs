use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use std::io::{Read, Write};

/// Gzip is lossless and checksums the uncompressed bytes. Legacy UTF-8 files
/// remain readable; the filename stays unchanged so deletion/sharding is stable.
pub fn encode(value: &str) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::new(6));
    encoder.write_all(value.as_bytes()).map_err(|e| e.to_string())?;
    let compressed = encoder.finish().map_err(|e| e.to_string())?;
    // Avoid making tiny preferences larger than the original.
    Ok(if compressed.len() < value.len() { compressed } else { value.as_bytes().to_vec() })
}

pub fn decode(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0x1f, 0x8b]) {
        let mut value = String::new();
        GzDecoder::new(bytes).read_to_string(&mut value).map_err(|e| e.to_string())?;
        Ok(value)
    } else {
        String::from_utf8(bytes.to_vec()).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_every_byte_including_unicode_results_and_history() {
        let value = format!("{{\"historia\":\"{}\",\"wynik\":\"2:0\",\"draft\":false}}", "Łódź 日本 0 null ".repeat(10_000));
        let encoded = encode(&value).unwrap();
        assert!(encoded.len() < value.len() / 4);
        assert_eq!(decode(&encoded).unwrap(), value);
    }

    #[test]
    fn reads_legacy_json_and_keeps_tiny_values_small() {
        let old = "{\"wynik\":\"3:1\"}";
        assert_eq!(decode(old.as_bytes()).unwrap(), old);
        assert_eq!(encode("1").unwrap(), b"1");
    }

    #[test]
    fn rejects_truncation_and_checksum_corruption() {
        let value = "historical match stats ".repeat(1_000);
        let mut encoded = encode(&value).unwrap();
        assert!(decode(&encoded[..encoded.len() - 4]).is_err());
        let checksum = encoded.len() - 8;
        encoded[checksum] ^= 0xff;
        assert!(decode(&encoded).is_err());
    }
}