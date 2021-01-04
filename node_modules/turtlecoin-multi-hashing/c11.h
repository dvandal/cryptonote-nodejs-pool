#ifndef C11_H
#define C11_H


#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

void c11_hash(const char* input, char* output, uint32_t len);

#ifdef __cplusplus
}
#endif

#endif // C11_H
