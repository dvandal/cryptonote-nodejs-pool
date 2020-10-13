#include "boolberry.h"
#include "crypto/cryptonote_core/cryptonote_format_utils.h"

#include <iostream>

void boolberry_hash(const char* input, uint32_t input_len, const char* scratchpad, uint64_t spad_length, char* output, uint64_t height) {
    crypto::hash* spad = (crypto::hash*) scratchpad;
    cryptonote::get_blob_longhash_bb(std::string(input, input_len), *((crypto::hash*)output), height, [&](uint64_t index) -> crypto::hash& {
        return spad[index%(spad_length / HASH_SIZE)];
    });
}
