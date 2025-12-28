import time

def set_window_title(title: str):
    # \x1b 是 ESC 符号
    # ]2; 是设置标题的 OSC 命令
    # \x07 是 BEL 符号 (结束符)
    # end='' 防止 print 后面自动加换行符
    print(f"\x1b]2;{title}\x07", end='', flush=True)

if __name__ == "__main__":
    current_time = time.strftime("%H:%M:%S")
    title = f"Qwen - {current_time}"
    set_window_title(title)
    
    input("按回车键退出...")