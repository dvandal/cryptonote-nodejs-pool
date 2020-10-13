// Copyright (c) 2012-2013 The Cryptonote developers
// Distributed under the MIT/X11 software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#include "include_base_utils.h"
using namespace epee;

#include "cryptonote_format_utils.h"
#include <boost/foreach.hpp>
#include "cryptonote_config.h"
#include "miner.h"
#include "crypto/crypto.h"
#include "crypto/hash.h"
#include "serialization/binary_utils.h"

namespace cryptonote
{
  //---------------------------------------------------------------
  void get_transaction_prefix_hash(const transaction_prefix& tx, crypto::hash& h)
  {
    std::ostringstream s;
    if (tx.blob_type == BLOB_TYPE_CRYPTONOTE_RYO) s << "ryo-currency";
    binary_archive<true> a(s);
    ::serialization::serialize(a, const_cast<transaction_prefix&>(tx));
    crypto::cn_fast_hash(s.str().data(), s.str().size(), h);
  }
  //---------------------------------------------------------------
  crypto::hash get_transaction_prefix_hash(const transaction_prefix& tx)
  {
    crypto::hash h = null_hash;
    get_transaction_prefix_hash(tx, h);
    return h;
  }
  //---------------------------------------------------------------
  bool parse_and_validate_tx_from_blob(const blobdata& tx_blob, transaction& tx)
  {
    std::stringstream ss;
    ss << tx_blob;
    binary_archive<false> ba(ss);
    bool r = ::serialization::serialize(ba, tx);
    CHECK_AND_ASSERT_MES(r, false, "Failed to parse transaction from blob");
    return true;
  }
  //---------------------------------------------------------------
  bool parse_and_validate_tx_from_blob(const blobdata& tx_blob, transaction& tx, crypto::hash& tx_hash, crypto::hash& tx_prefix_hash)
  {
    std::stringstream ss;
    ss << tx_blob;
    binary_archive<false> ba(ss);
    bool r = ::serialization::serialize(ba, tx);
    CHECK_AND_ASSERT_MES(r, false, "Failed to parse transaction from blob");
    //TODO: validate tx

    crypto::cn_fast_hash(tx_blob.data(), tx_blob.size(), tx_hash);
    get_transaction_prefix_hash(tx, tx_prefix_hash);
    return true;
  }
  //---------------------------------------------------------------
  bool generate_key_image_helper(const account_keys& ack, const crypto::public_key& tx_public_key, size_t real_output_index, keypair& in_ephemeral, crypto::key_image& ki)
  {
    crypto::key_derivation recv_derivation = AUTO_VAL_INIT(recv_derivation);
    bool r = crypto::generate_key_derivation(tx_public_key, ack.m_view_secret_key, recv_derivation);
    CHECK_AND_ASSERT_MES(r, false, "key image helper: failed to generate_key_derivation(" << tx_public_key << ", " << ack.m_view_secret_key << ")");

    r = crypto::derive_public_key(recv_derivation, real_output_index, ack.m_account_address.m_spend_public_key, in_ephemeral.pub);
    CHECK_AND_ASSERT_MES(r, false, "key image helper: failed to derive_public_key(" << recv_derivation << ", " << real_output_index <<  ", " << ack.m_account_address.m_spend_public_key << ")");

    crypto::derive_secret_key(recv_derivation, real_output_index, ack.m_spend_secret_key, in_ephemeral.sec);

    crypto::generate_key_image(in_ephemeral.pub, in_ephemeral.sec, ki);
    return true;
  }
  //---------------------------------------------------------------
  uint64_t power_integral(uint64_t a, uint64_t b)
  {
    if(b == 0)
      return 1;
    uint64_t total = a;
    for(uint64_t i = 1; i != b; i++)
      total *= a;
    return total;
  }
  //---------------------------------------------------------------
  bool get_tx_fee(const transaction& tx, uint64_t & fee)
  {
    uint64_t amount_in = 0;
    uint64_t amount_out = 0;
    BOOST_FOREACH(auto& in, tx.vin)
    {
      if (tx.blob_type != BLOB_TYPE_CRYPTONOTE_XHV) {
        CHECK_AND_ASSERT_MES(in.type() == typeid(txin_to_key), 0, "unexpected type id in transaction");
        amount_in += boost::get<txin_to_key>(in).amount;
      } else {
        CHECK_AND_ASSERT_MES(in.type() == typeid(txin_to_key) || in.type() == typeid(txin_offshore) || in.type() == typeid(txin_onshore), 0, "unexpected type id in transaction");
        amount_in += in.type() == typeid(txin_to_key) ? boost::get<txin_to_key>(in).amount : in.type() == typeid(txin_onshore) ? boost::get<txin_onshore>(in).amount : boost::get<txin_offshore>(in).amount;
      }
    }
    BOOST_FOREACH(auto& o, tx.vout)
      amount_out += o.amount;

    CHECK_AND_ASSERT_MES(amount_in >= amount_out, false, "transaction spend (" <<amount_in << ") more than it has (" << amount_out << ")");
    fee = amount_in - amount_out;
    return true;
  }
  //---------------------------------------------------------------
  uint64_t get_tx_fee(const transaction& tx)
  {
    uint64_t r = 0;
    if(!get_tx_fee(tx, r))
      return 0;
    return r;
  }
  //---------------------------------------------------------------
  bool parse_tx_extra(const std::vector<uint8_t>& tx_extra, std::vector<tx_extra_field>& tx_extra_fields)
  {
    tx_extra_fields.clear();

    if(tx_extra.empty())
      return true;

    std::string extra_str(reinterpret_cast<const char*>(tx_extra.data()), tx_extra.size());
    std::istringstream iss(extra_str);
    binary_archive<false> ar(iss);

    bool eof = false;
    while (!eof)
    {
      tx_extra_field field;
      bool r = ::do_serialize(ar, field);
      CHECK_AND_NO_ASSERT_MES(r, false, "failed to deserialize extra field. extra = " << string_tools::buff_to_hex_nodelimer(std::string(reinterpret_cast<const char*>(tx_extra.data()), tx_extra.size())));
      tx_extra_fields.push_back(field);

      std::ios_base::iostate state = iss.rdstate();
      eof = (EOF == iss.peek());
      iss.clear(state);
    }
    CHECK_AND_NO_ASSERT_MES(::serialization::check_stream_state(ar), false, "failed to deserialize extra field. extra = " << string_tools::buff_to_hex_nodelimer(std::string(reinterpret_cast<const char*>(tx_extra.data()), tx_extra.size())));

    return true;
  }
  //---------------------------------------------------------------
  crypto::public_key get_tx_pub_key_from_extra(const std::vector<uint8_t>& tx_extra)
  {
    std::vector<tx_extra_field> tx_extra_fields;
    parse_tx_extra(tx_extra, tx_extra_fields);

    tx_extra_pub_key pub_key_field;
    if(!find_tx_extra_field_by_type(tx_extra_fields, pub_key_field))
      return null_pkey;

    return pub_key_field.pub_key;
  }
  //---------------------------------------------------------------
  crypto::public_key get_tx_pub_key_from_extra(const transaction& tx)
  {
    return get_tx_pub_key_from_extra(tx.extra);
  }
  //---------------------------------------------------------------
  bool add_tx_pub_key_to_extra(transaction& tx, const crypto::public_key& tx_pub_key)
  {
    tx.extra.resize(tx.extra.size() + 1 + sizeof(crypto::public_key));
    tx.extra[tx.extra.size() - 1 - sizeof(crypto::public_key)] = TX_EXTRA_TAG_PUBKEY;
    *reinterpret_cast<crypto::public_key*>(&tx.extra[tx.extra.size() - sizeof(crypto::public_key)]) = tx_pub_key;
    return true;
  }
  //---------------------------------------------------------------
  bool add_extra_nonce_to_tx_extra(std::vector<uint8_t>& tx_extra, const blobdata& extra_nonce)
  {
    CHECK_AND_ASSERT_MES(extra_nonce.size() <= TX_EXTRA_NONCE_MAX_COUNT, false, "extra nonce could be 255 bytes max");
    size_t start_pos = tx_extra.size();
    tx_extra.resize(tx_extra.size() + 2 + extra_nonce.size());
    //write tag
    tx_extra[start_pos] = TX_EXTRA_NONCE;
    //write len
    ++start_pos;
    tx_extra[start_pos] = static_cast<uint8_t>(extra_nonce.size());
    //write data
    ++start_pos;
    memcpy(&tx_extra[start_pos], extra_nonce.data(), extra_nonce.size());
    return true;
  }
  //---------------------------------------------------------------
  bool append_mm_tag_to_extra(std::vector<uint8_t>& tx_extra, const tx_extra_merge_mining_tag& mm_tag)
  {
    blobdata blob;
    if (!t_serializable_object_to_blob(mm_tag, blob))
      return false;

    tx_extra.push_back(TX_EXTRA_MERGE_MINING_TAG);
    std::copy(reinterpret_cast<const uint8_t*>(blob.data()), reinterpret_cast<const uint8_t*>(blob.data() + blob.size()), std::back_inserter(tx_extra));
    return true;
  }
  //---------------------------------------------------------------
  bool get_mm_tag_from_extra(const std::vector<uint8_t>& tx_extra, tx_extra_merge_mining_tag& mm_tag)
  {
    std::vector<tx_extra_field> tx_extra_fields;
    if (!parse_tx_extra(tx_extra, tx_extra_fields))
      return false;

    return find_tx_extra_field_by_type(tx_extra_fields, mm_tag);
  }
  //---------------------------------------------------------------
  void set_payment_id_to_tx_extra_nonce(blobdata& extra_nonce, const crypto::hash& payment_id)
  {
    extra_nonce.clear();
    extra_nonce.push_back(TX_EXTRA_NONCE_PAYMENT_ID);
    const uint8_t* payment_id_ptr = reinterpret_cast<const uint8_t*>(&payment_id);
    std::copy(payment_id_ptr, payment_id_ptr + sizeof(payment_id), std::back_inserter(extra_nonce));
  }
  //---------------------------------------------------------------
  bool get_payment_id_from_tx_extra_nonce(const blobdata& extra_nonce, crypto::hash& payment_id)
  {
    if(sizeof(crypto::hash) + 1 != extra_nonce.size())
      return false;
    if(TX_EXTRA_NONCE_PAYMENT_ID != extra_nonce[0])
      return false;
    payment_id = *reinterpret_cast<const crypto::hash*>(extra_nonce.data() + 1);
    return true;
  }
  //---------------------------------------------------------------
  bool get_inputs_money_amount(const transaction& tx, uint64_t& money)
  {
    money = 0;
    BOOST_FOREACH(const auto& in, tx.vin)
    {
      CHECKED_GET_SPECIFIC_VARIANT(in, const txin_to_key, tokey_in, false);
      money += tokey_in.amount;
    }
    return true;
  }
  //---------------------------------------------------------------
  uint64_t get_block_height(const block& b)
  {
    CHECK_AND_ASSERT_MES(b.miner_tx.vin.size() == 1, 0, "wrong miner tx in block: " << get_block_hash(b) << ", b.miner_tx.vin.size() != 1");
    CHECKED_GET_SPECIFIC_VARIANT(b.miner_tx.vin[0], const txin_gen, coinbase_in, 0);
    return coinbase_in.height;
  }
  //---------------------------------------------------------------
  bool check_inputs_types_supported(const transaction& tx)
  {
    BOOST_FOREACH(const auto& in, tx.vin)
    {
      if (tx.blob_type != BLOB_TYPE_CRYPTONOTE_XHV) {
        CHECK_AND_ASSERT_MES(in.type() == typeid(txin_to_key), false, "wrong variant type: "
          << in.type().name() << ", expected " << typeid(txin_to_key).name()
          << ", in transaction id=" << get_transaction_hash(tx));
      } else {
        CHECK_AND_ASSERT_MES(in.type() == typeid(txin_to_key) || in.type() == typeid(txin_offshore) || in.type() == typeid(txin_onshore), false, "wrong variant type: "
          << in.type().name() << ", expected " << typeid(txin_to_key).name() << "or " << typeid(txin_onshore).name()
          << ", in transaction id=" << get_transaction_hash(tx));
      }
    }
    return true;
  }
  //-----------------------------------------------------------------------------------------------
  bool check_outs_valid(const transaction& tx)
  {
    BOOST_FOREACH(const tx_out& out, tx.vout)
    {
      if (tx.blob_type != BLOB_TYPE_CRYPTONOTE_XHV) {
        CHECK_AND_ASSERT_MES(out.target.type() == typeid(txout_to_key), false, "wrong variant type: "
          << out.target.type().name() << ", expected " << typeid(txout_to_key).name()
          << ", in transaction id=" << get_transaction_hash(tx));
      } else {
        CHECK_AND_ASSERT_MES(out.target.type() == typeid(txout_to_key) || out.target.type() == typeid(txout_offshore), false, "wrong variant type: "
          << out.target.type().name() << ", expected " << typeid(txout_to_key).name()
	  << "or " << typeid(txout_offshore).name()
	  << ", in transaction id=" << get_transaction_hash(tx));
      }

      if (tx.version == 1)
      {
        CHECK_AND_NO_ASSERT_MES(0 < out.amount, false, "zero amount ouput in transaction id=" << get_transaction_hash(tx));
      }

      if (tx.blob_type != BLOB_TYPE_CRYPTONOTE_XHV) {
        if(!check_key(boost::get<txout_to_key>(out.target).key))
          return false;
      } else {
        if(!check_key(out.target.type() == typeid(txout_to_key) ? boost::get<txout_to_key>(out.target).key : boost::get<txout_offshore>(out.target).key))
          return false;
      }
    }
    return true;
  }
  //-----------------------------------------------------------------------------------------------
  bool check_money_overflow(const transaction& tx)
  {
    return check_inputs_overflow(tx) && check_outs_overflow(tx);
  }
  //---------------------------------------------------------------
  bool check_inputs_overflow(const transaction& tx)
  {
    uint64_t money = 0;
    BOOST_FOREACH(const auto& in, tx.vin)
    {
      if (tx.blob_type == BLOB_TYPE_CRYPTONOTE_XHV && tx.vin[0].type() == typeid(txin_offshore)) {
        CHECKED_GET_SPECIFIC_VARIANT(in, const txin_offshore, tokey_in, false);
        if(money > tokey_in.amount + money)
          return false;
        money += tokey_in.amount;
      } else if (tx.blob_type == BLOB_TYPE_CRYPTONOTE_XHV && tx.vin[0].type() == typeid(txin_onshore)) {
        CHECKED_GET_SPECIFIC_VARIANT(in, const txin_onshore, tokey_in, false);
        if(money > tokey_in.amount + money)
          return false;
        money += tokey_in.amount;
      } else {
        CHECKED_GET_SPECIFIC_VARIANT(in, const txin_to_key, tokey_in, false);
        if(money > tokey_in.amount + money)
          return false;
        money += tokey_in.amount;
      }
    }
    return true;
  }
  //---------------------------------------------------------------
  bool check_outs_overflow(const transaction& tx)
  {
    uint64_t money = 0;
    BOOST_FOREACH(const auto& o, tx.vout)
    {
      if(money > o.amount + money)
        return false;
      money += o.amount;
    }
    return true;
  }
  //---------------------------------------------------------------
  uint64_t get_outs_money_amount(const transaction& tx)
  {
    uint64_t outputs_amount = 0;
    BOOST_FOREACH(const auto& o, tx.vout)
      outputs_amount += o.amount;
    return outputs_amount;
  }
  //---------------------------------------------------------------
  std::string short_hash_str(const crypto::hash& h)
  {
    std::string res = string_tools::pod_to_hex(h);
    CHECK_AND_ASSERT_MES(res.size() == 64, res, "wrong hash256 with string_tools::pod_to_hex conversion");
    auto erased_pos = res.erase(8, 48);
    res.insert(8, "....");
    return res;
  }
  //---------------------------------------------------------------
  bool is_out_to_acc(const account_keys& acc, const txout_to_key& out_key, const crypto::public_key& tx_pub_key, size_t output_index)
  {
    crypto::key_derivation derivation;
    generate_key_derivation(tx_pub_key, acc.m_view_secret_key, derivation);
    crypto::public_key pk;
    derive_public_key(derivation, output_index, acc.m_account_address.m_spend_public_key, pk);
    return pk == out_key.key;
  }
  //---------------------------------------------------------------
  bool lookup_acc_outs(const account_keys& acc, const transaction& tx, std::vector<size_t>& outs, uint64_t& money_transfered)
  {
    crypto::public_key tx_pub_key = get_tx_pub_key_from_extra(tx);
    if(null_pkey == tx_pub_key)
      return false;
    return lookup_acc_outs(acc, tx, tx_pub_key, outs, money_transfered);
  }
  //---------------------------------------------------------------
  bool lookup_acc_outs(const account_keys& acc, const transaction& tx, const crypto::public_key& tx_pub_key, std::vector<size_t>& outs, uint64_t& money_transfered)
  {
    money_transfered = 0;
    size_t i = 0;
    BOOST_FOREACH(const tx_out& o,  tx.vout)
    {
      CHECK_AND_ASSERT_MES(o.target.type() ==  typeid(txout_to_key), false, "wrong type id in transaction out" );
      if(is_out_to_acc(acc, boost::get<txout_to_key>(o.target), tx_pub_key, i))
      {
        outs.push_back(i);
        money_transfered += o.amount;
      }
      i++;
    }
    return true;
  }
  //---------------------------------------------------------------
  void get_blob_hash(const blobdata& blob, crypto::hash& res)
  {
    cn_fast_hash(blob.data(), blob.size(), res);
  }
  //---------------------------------------------------------------
  crypto::hash get_blob_hash(const blobdata& blob)
  {
    crypto::hash h = null_hash;
    get_blob_hash(blob, h);
    return h;
  }
  //---------------------------------------------------------------
  crypto::hash get_transaction_hash(const transaction& t)
  {
    crypto::hash h = null_hash;
    size_t blob_size = 0;
    get_object_hash(t, h, blob_size);
    return h;
  }
  //---------------------------------------------------------------
  bool get_transaction_hash(const transaction& t, crypto::hash& res)
  {
    size_t blob_size = 0;
    return get_object_hash(t, res, blob_size);
  }

  //---------------------------------------------------------------
  bool get_transaction_hash(const transaction& t, crypto::hash& res, size_t* blob_size)
  {
    // v1 transactions hash the entire blob
    if (t.version == 1 && t.blob_type != BLOB_TYPE_CRYPTONOTE2 && t.blob_type != BLOB_TYPE_CRYPTONOTE3)
    {
      size_t ignored_blob_size, &blob_size_ref = blob_size ? *blob_size : ignored_blob_size;
      return get_object_hash(t, res, blob_size_ref);
    }

    // v2 transactions hash different parts together, than hash the set of those hashes
    crypto::hash hashes[3];

    // prefix
    get_transaction_prefix_hash(t, hashes[0]);

    transaction &tt = const_cast<transaction&>(t);

    // base rct
    {
      std::stringstream ss;
      binary_archive<true> ba(ss);
      const size_t inputs = t.vin.size();
      const size_t outputs = t.vout.size();
      bool r = tt.rct_signatures.serialize_rctsig_base(ba, inputs, outputs);
      CHECK_AND_ASSERT_MES(r, false, "Failed to serialize rct signatures base");
      cryptonote::get_blob_hash(ss.str(), hashes[1]);
    }

    // prunable rct
    if (t.rct_signatures.type == rct::RCTTypeNull)
    {
      hashes[2] = cryptonote::null_hash;
    }
    else
    {
      std::stringstream ss;
      binary_archive<true> ba(ss);
      const size_t inputs = t.vin.size();
      const size_t outputs = t.vout.size();
      size_t mixin;
      if (t.blob_type != BLOB_TYPE_CRYPTONOTE_XHV) {
        mixin = t.vin.empty() ? 0 : t.vin[0].type() == typeid(txin_to_key) ? boost::get<txin_to_key>(t.vin[0]).key_offsets.size() - 1 : 0;
      } else {
        mixin = t.vin.empty() ? 0 :
	t.vin[0].type() == typeid(txin_to_key) ? boost::get<txin_to_key>(t.vin[0]).key_offsets.size() - 1 :
	t.vin[0].type() == typeid(txin_offshore) ? boost::get<txin_offshore>(t.vin[0]).key_offsets.size() - 1 :
	t.vin[0].type() == typeid(txin_onshore) ? boost::get<txin_onshore>(t.vin[0]).key_offsets.size() - 1 :
	0;
      }
      bool r = tt.rct_signatures.p.serialize_rctsig_prunable(ba, t.rct_signatures.type, inputs, outputs, mixin);
      CHECK_AND_ASSERT_MES(r, false, "Failed to serialize rct signatures prunable");
      cryptonote::get_blob_hash(ss.str(), hashes[2]);
    }

    // the tx hash is the hash of the 3 hashes
    res = cn_fast_hash(hashes, sizeof(hashes));

    // we still need the size
    if (blob_size)
      *blob_size = get_object_blobsize(t);

    return true;
  }
  //---------------------------------------------------------------
  bool get_transaction_hash(const transaction& t, crypto::hash& res, size_t& blob_size)
  {
    return get_transaction_hash(t, res, &blob_size);
  }
  //---------------------------------------------------------------
  bool get_block_hashing_blob(const block& b, blobdata& blob)
  {
    if (b.blob_type == BLOB_TYPE_CRYPTONOTE_XTNC || b.blob_type == BLOB_TYPE_CRYPTONOTE_CUCKOO || b.blob_type == BLOB_TYPE_CRYPTONOTE_TUBE || b.blob_type == BLOB_TYPE_CRYPTONOTE_XTA) {
      blob = t_serializable_object_to_blob(b.major_version);
      blob.append(reinterpret_cast<const char*>(&b.minor_version), sizeof(b.minor_version));
      blob.append(reinterpret_cast<const char*>(&b.timestamp), sizeof(b.timestamp));
      blob.append(reinterpret_cast<const char*>(&b.prev_id), sizeof(b.prev_id));
    }
    else {
      blob = t_serializable_object_to_blob(static_cast<const block_header&>(b));
    }
    crypto::hash tree_root_hash = get_tx_tree_hash(b);
    blob.append(reinterpret_cast<const char*>(&tree_root_hash), sizeof(tree_root_hash));
    blob.append(tools::get_varint_data(b.tx_hashes.size()+1));
    if (b.blob_type == BLOB_TYPE_CRYPTONOTE3) {
      blob.append(reinterpret_cast<const char*>(&b.uncle), sizeof(b.uncle));
    }
    if (b.blob_type == BLOB_TYPE_CRYPTONOTE_CUCKOO || b.blob_type == BLOB_TYPE_CRYPTONOTE_TUBE || b.blob_type == BLOB_TYPE_CRYPTONOTE_XTA) {
      blob.append(reinterpret_cast<const char*>(&b.nonce8), sizeof(b.nonce8));
    }
    return true;
  }
  //---------------------------------------------------------------
  bool get_bytecoin_block_hashing_blob(const block& b, blobdata& blob)
  {
    auto sbb = make_serializable_bytecoin_block(b, true, true);
    return t_serializable_object_to_blob(sbb, blob);
  }
  //---------------------------------------------------------------
  bool get_block_hash(const block& b, crypto::hash& res)
  {
    blobdata blob;
    if (!get_block_hashing_blob(b, blob))
      return false;

    if (b.blob_type == BLOB_TYPE_FORKNOTE2)
    {
      blobdata parent_blob;
      auto sbb = make_serializable_bytecoin_block(b, true, false);
      if (!t_serializable_object_to_blob(sbb, parent_blob))
        return false;

      blob.append(parent_blob);
    }

    return get_object_hash(blob, res);
  }
  //---------------------------------------------------------------
  crypto::hash get_block_hash(const block& b)
  {
    crypto::hash p = null_hash;
    get_block_hash(b, p);
    return p;
  }
  //---------------------------------------------------------------
  bool get_block_header_hash(const block& b, crypto::hash& res)
  {
    blobdata blob;
    if (!get_block_hashing_blob(b, blob))
      return false;

    return get_object_hash(blob, res);
  }
  //---------------------------------------------------------------
  std::vector<uint64_t> relative_output_offsets_to_absolute(const std::vector<uint64_t>& off)
  {
    std::vector<uint64_t> res = off;
    for(size_t i = 1; i < res.size(); i++)
      res[i] += res[i-1];
    return res;
  }
  //---------------------------------------------------------------
  std::vector<uint64_t> absolute_output_offsets_to_relative(const std::vector<uint64_t>& off)
  {
    std::vector<uint64_t> res = off;
    if(!off.size())
      return res;
    std::sort(res.begin(), res.end());//just to be sure, actually it is already should be sorted
    for(size_t i = res.size()-1; i != 0; i--)
      res[i] -= res[i-1];

    return res;
  }
  //---------------------------------------------------------------
  bool get_bytecoin_block_longhash(const block& b, crypto::hash& res)
  {
    blobdata bd;
    if(!get_bytecoin_block_hashing_blob(b, bd))
      return false;
    crypto::cn_slow_hash(bd.data(), bd.size(), res);
    return true;
  }
  //---------------------------------------------------------------
  bool parse_and_validate_block_from_blob(const blobdata& b_blob, block& b)
  {
    std::stringstream ss;
    ss << b_blob;
    binary_archive<false> ba(ss);
    bool r = ::serialization::serialize(ba, b);
    CHECK_AND_ASSERT_MES(r, false, "Failed to parse block from blob");
    return true;
  }
  //---------------------------------------------------------------
  blobdata block_to_blob(const block& b)
  {
    return t_serializable_object_to_blob(b);
  }
  //---------------------------------------------------------------
  bool block_to_blob(const block& b, blobdata& b_blob)
  {
    return t_serializable_object_to_blob(b, b_blob);
  }
  //---------------------------------------------------------------
  blobdata tx_to_blob(const transaction& tx)
  {
    return t_serializable_object_to_blob(tx);
  }
  //---------------------------------------------------------------
  bool tx_to_blob(const transaction& tx, blobdata& b_blob)
  {
    return t_serializable_object_to_blob(tx, b_blob);
  }
  //---------------------------------------------------------------
  void get_tx_tree_hash(const std::vector<crypto::hash>& tx_hashes, crypto::hash& h)
  {
    tree_hash(tx_hashes.data(), tx_hashes.size(), h);
  }
  //---------------------------------------------------------------
  crypto::hash get_tx_tree_hash(const std::vector<crypto::hash>& tx_hashes)
  {
    crypto::hash h = null_hash;
    get_tx_tree_hash(tx_hashes, h);
    return h;
  }
  //---------------------------------------------------------------
  crypto::hash get_tx_tree_hash(const block& b)
  {
    std::vector<crypto::hash> txs_ids;
    crypto::hash h = null_hash;
    size_t bl_sz = 0;
    get_transaction_hash(b.miner_tx, h, bl_sz);
    txs_ids.push_back(h);
    BOOST_FOREACH(auto& th, b.tx_hashes)
      txs_ids.push_back(th);
    return get_tx_tree_hash(txs_ids);
  }
  //---------------------------------------------------------------
}
