#ifndef SHA1_H
#define SHA1_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

void sha1_hash(const char* input, char* output, uint32_t len);

#ifdef __cplusplus
}
#endif

#endif
