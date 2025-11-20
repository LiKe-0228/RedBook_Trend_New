from upload_to_feishu import upload_note_rows, upload_account_rows


def main() -> None:
    note_row = {
        "title": "【测试】内容榜单条",
        "nickname": "测试账号A",
        "publishTime": "2025-11-01",
        "readCount": "1万-3万",
        "clickRate": "5%-15%",
        "payConversionRate": "10%-20%",
        "gmv": "￥1000-3000",
        "fetchDate": "2025-11-18",
    }

    print("=== 上传 1 条内容榜测试数据 ===")
    upload_note_rows([note_row])

    account_row = {
        "shopName": "【测试】店铺B",
        "fansCount": "12345",
        "readCount": "3万-5万",
        "clickRate": "15%-25%",
        "payConversionRate": "20%-30%",
        "gmv": "￥3000-5000",
        "fetchDate": "2025-11-18",
    }

    print("=== 上传 1 条账号榜测试数据 ===")
    upload_account_rows([account_row])


if __name__ == "__main__":
    main()
