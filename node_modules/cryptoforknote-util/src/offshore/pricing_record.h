// Copyright (c) 2019, Haven Protocol
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
//    conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list
//    of conditions and the following disclaimer in the documentation and/or other
//    materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be
//    used to endorse or promote products derived from this software without specific
//    prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
// THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
// STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
// THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// Portions of this code based upon code Copyright (c) 2019, The Monero Project

#pragma once
#include "common/pod-class.h"

#include <cstdint>

namespace epee
{
  namespace serialization
  {
    class portable_storage;
    struct section;
  }
}

namespace offshore
{

#pragma pack(push, 1)
  POD_CLASS pricing_record_old {
    double xAG;
    double xAU;
    double xAUD;
    double xBTC;
    double xCAN;
    double xCHF;
    double xCNY;
    double xEUR;
    double xGBP;
    double xJPY;
    double xNOK;
    double xNZD;
    double xUSD;
    double unused1;
    double unused2;
    double unused3;
    char signature[32];
  };
#pragma pack(pop)

  class pricing_record
  {

  public:

    // Fields 
    uint64_t xAG;
    uint64_t xAU;
    uint64_t xAUD;
    uint64_t xBTC;
    uint64_t xCAD;
    uint64_t xCHF;
    uint64_t xCNY;
    uint64_t xEUR;
    uint64_t xGBP;
    uint64_t xJPY;
    uint64_t xNOK;
    uint64_t xNZD;
    uint64_t xUSD;
    uint64_t unused1;
    uint64_t unused2;
    uint64_t unused3;
    unsigned char signature[64];

    // Default c'tor
    pricing_record() noexcept;
    
    //! Load from epee p2p format
    bool _load(epee::serialization::portable_storage& src, epee::serialization::section* hparent);
    
    //! Store in epee p2p format
    bool store(epee::serialization::portable_storage& dest, epee::serialization::section* hparent) const;
    pricing_record(const pricing_record& orig) noexcept;
    ~pricing_record() = default;
    pricing_record& operator=(const pricing_record& orig) noexcept;
    
    bool equal(const pricing_record& other) const noexcept;

    bool verifySignature() const noexcept;
  };

  inline bool operator==(const pricing_record& a, const pricing_record& b) noexcept
  {
   return a.equal(b);
  }
  
  inline bool operator!=(const pricing_record& a, const pricing_record& b) noexcept
  {
   return !a.equal(b);
  }

} // offshore