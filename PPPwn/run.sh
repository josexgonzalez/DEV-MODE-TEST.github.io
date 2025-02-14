#!/bin/bash

if [ -f /boot/firmware/PPPwn/config.sh ]; then
source /boot/firmware/PPPwn/config.sh
fi
if [ -z $PYPWN ]; then PYPWN=false; fi
if [ $PYPWN = true ] ; then
sudo bash /boot/firmware/PPPwn/runpy.sh
exit 0
fi
if [ -f /boot/firmware/PPPwn/pconfig.sh ]; then
source /boot/firmware/PPPwn/pconfig.sh
fi
if [ -z $INTERFACE ]; then INTERFACE="eth0"; fi
if [ -z $FIRMWAREVERSION ]; then FIRMWAREVERSION="4.03"; fi
if [ -z $SHUTDOWN ]; then SHUTDOWN=true; fi
if [ -z $USBETHERNET ]; then USBETHERNET=false; fi
if [ -z $PPPOECONN ]; then PPPOECONN=false; fi
if [ -z $VMUSB ]; then VMUSB=false; fi
if [ -z $DTLINK ]; then DTLINK=false; fi
if [ -z $PPDBG ]; then PPDBG=false; fi
if [ -z $TIMEOUT ]; then TIMEOUT="5m"; fi
if [ -z $RESTMODE ]; then RESTMODE=false; fi
if [ -z $LEDACT ]; then LEDACT="normal"; fi
if [ -z $XFWAP ]; then XFWAP="1"; fi
if [ -z $XFGD ]; then XFGD="4"; fi
if [ -z $XFBS ]; then XFBS="0"; fi
if [ -z $XFNWB ]; then XFNWB=false; fi
if [ -z $OIPV ]; then OIPV=false; fi
if [ -z $UGH ]; then UGH=true; fi
if [ $OIPV = true ] ; then
XFIP="fe80::4141:4141:4141:4141"
else
XFIP="fe80::9f9f:41ff:9f9f:41ff"
fi
if [ $XFNWB = true ] ; then
XFNW="--no-wait-padi"
else
XFNW=""
fi
if [ $UGH = true ] ; then
if [[ $FIRMWAREVERSION == "4.03" ]] || [[ $FIRMWAREVERSION == "9.60" ]] || [[ $FIRMWAREVERSION == "10.00" ]] || [[ $FIRMWAREVERSION == "10.01" ]] || [[ $FIRMWAREVERSION == "11.00" ]] ; then
XFGH="-gh"
else
XFGH=""
UGH=false
fi
else
XFGH=""
fi
PITYP=$(tr -d '\0' </proc/device-tree/model) 
if [[ $PITYP == *"Raspberry Pi 2"* ]] ;then
coproc read -t 15 && wait "$!" || true
CPPBIN="pppwn7"
VMUSB=false
elif [[ $PITYP == *"Raspberry Pi 3"* ]] ;then
coproc read -t 10 && wait "$!" || true
CPPBIN="pppwn64"
VMUSB=false
elif [[ $PITYP == *"Raspberry Pi 4"* ]] ;then
coproc read -t 5 && wait "$!" || true
CPPBIN="pppwn64"
elif [[ $PITYP == *"Raspberry Pi 5"* ]] ;then
coproc read -t 5 && wait "$!" || true
CPPBIN="pppwn64"
elif [[ $PITYP == *"Raspberry Pi Zero 2"* ]] ;then
coproc read -t 8 && wait "$!" || true
CPPBIN="pppwn64"
VMUSB=false
elif [[ $PITYP == *"Raspberry Pi Zero"* ]] ;then
coproc read -t 10 && wait "$!" || true
CPPBIN="pppwn11"
VMUSB=false
elif [[ $PITYP == *"Raspberry Pi"* ]] ;then
coproc read -t 15 && wait "$!" || true
CPPBIN="pppwn11"
VMUSB=false
else
coproc read -t 5 && wait "$!" || true
CPPBIN="pppwn64"
VMUSB=false
fi
arch=$(getconf LONG_BIT)
if [ $arch -eq 32 ] && [ $CPPBIN = "pppwn64" ] && [[ ! $PITYP == *"Raspberry Pi 4"* ]] && [[ ! $PITYP == *"Raspberry Pi 5"* ]] ; then
CPPBIN="pppwn7"
fi
PLED=""
ALED=""
if [[ $LEDACT == "status" ]] || [[ $LEDACT == "off" ]] ;then
   if [ -f /sys/class/leds/PWR/trigger ] && [ -f /sys/class/leds/ACT/trigger ]  ; then
      PLED="/sys/class/leds/PWR/trigger"
      ALED="/sys/class/leds/ACT/trigger"
      echo none | sudo tee $PLED >/dev/null
      echo none | sudo tee $ALED >/dev/null
   elif [ -f /sys/class/leds/user-led1/trigger ] && [ -f /sys/class/leds/user-led2/trigger ]  ; then
      PLED="/sys/class/leds/user-led1/trigger"
      ALED="/sys/class/leds/user-led2/trigger"
      echo none | sudo tee $PLED >/dev/null
      echo none | sudo tee $ALED >/dev/null
   else
      LEDACT="normal"
   fi
fi
echo -e "\n\n\033[36m _____  _____  _____                               
|  __ \\|  __ \\|  __ \\                    _     _   
| |__) | |__) | |__) |_      ___ __    _| |_ _| |_ 
|  ___/|  ___/|  ___/\\ \\ /\\ / / '_ \\  |_   _|_   _|
| |    | |    | |     \\ V  V /| | | |   |_|   |_|  
|_|    |_|    |_|      \\_/\\_/ |_| |_|\033[0m
\n\033[33mhttps://github.com/TheOfficialFloW/PPPwn\033[0m\n" | sudo tee /dev/tty1

echo -e "\n\033[36m$PITYP\033[92m\nFirmware:\033[93m $FIRMWAREVERSION\033[92m\nInterface:\033[93m $INTERFACE\033[0m" | sudo tee /dev/tty1

# Asegurar que la interfaz de red esté arriba
if [ $USBETHERNET = true ]; then
    sudo bash /boot/firmware/PPPwn/devboot.sh
    coproc read -t 3 && wait "$!" || true
    sudo ip link set $INTERFACE up
else
    sudo ip link set $INTERFACE down
    coproc read -t 5 && wait "$!" || true
    sudo ip link set $INTERFACE up
fi

# Esperar a que la conexión de red esté activa
if [[ ! $(ethtool $INTERFACE) == *"Link detected: yes"* ]]; then
    echo -e "\033[31mWaiting for link\033[0m" | sudo tee /dev/tty1
    while [[ ! $(ethtool $INTERFACE) == *"Link detected: yes"* ]]; do
        coproc read -t 2 && wait "$!" || true
    done
    echo -e "\033[32mLink found\033[0m\n" | sudo tee /dev/tty1
fi

# Configuración de PPPoE para conexión a internet
if [ $PPPOECONN = true ]; then
    echo -e "\033[92mStarting PPPoE connection...\033[0m" | sudo tee /dev/tty1
    sudo systemctl start pppoe

    # Comprobar si la conexión PPPoE fue exitosa
    if [[ $(systemctl is-active pppoe) == "active" ]]; then
        echo -e "\033[92mInternet Access:\033[93m Enabled\033[0m" | sudo tee /dev/tty1
    else
        echo -e "\033[31mFailed to establish PPPoE connection\033[0m" | sudo tee /dev/tty1
    fi
else
    echo -e "\033[92mInternet Access:\033[93m Disabled\033[0m" | sudo tee /dev/tty1
fi

# Mostrar dirección IP si está conectada
PIIP=$(hostname -I) || true
if [ "$PIIP" ]; then
    echo -e "\n\033[92mIP: \033[93m $PIIP\033[0m" | sudo tee /dev/tty1
else
    echo -e "\033[31mNo IP address detected\033[0m" | sudo tee /dev/tty1
fi

echo -e "\n\033[95mReady for console connection\033[0m\n" | sudo tee /dev/tty1

# Mantener el script activo y revisando la conexión
while true; do
    if [[ $(systemctl is-active pppoe) != "active" ]]; then
        echo -e "\033[31mLost PPPoE connection, attempting to reconnect...\033[0m" | sudo tee /dev/tty1
        sudo systemctl restart pppoe
        coproc read -t 5 && wait "$!" || true
    fi
    coproc read -t 10 && wait "$!" || true
done