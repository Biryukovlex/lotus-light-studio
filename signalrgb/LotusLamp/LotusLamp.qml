Item {
	anchors.fill: parent
	Column {
		width: 450
		spacing: 10
		Rectangle {
			width: parent.width
			height: 110
			color: "#141414"
			radius: 5
			Column {
				x: 10
				y: 10
				width: parent.width - 20
				spacing: 6
				Text {
					color: theme.primarytextcolor
					text: "Lotus Lamp (Bluetooth bridge)"
					font.pixelSize: 16
					font.family: "Poppins"
					font.bold: true
				}
				Text {
					color: theme.secondarytextcolor
					width: parent.width
					wrapMode: Text.WordWrap
					text: "Start Lotus Light Studio, connect the lamp and turn on SignalRGB sync. Colors are sent to this PC only (127.0.0.1)."
					font.pixelSize: 12
					font.family: "Poppins"
				}
			}
		}
		Rectangle {
			width: parent.width
			height: 70
			color: "#141414"
			radius: 5
			Row {
				x: 10
				y: 10
				spacing: 8
				Text {
					anchors.verticalCenter: parent.verticalCenter
					color: theme.primarytextcolor
					text: "UDP port"
					font.pixelSize: 14
					font.family: "Poppins"
				}
				TextField {
					id: lotusPort
					width: 100
					color: theme.primarytextcolor
					font.family: "Poppins"
					placeholderText: "8421"
					validator: IntValidator { bottom: 1024; top: 65535 }
					onAccepted: discovery.setPort(lotusPort.text)
				}
				ToolButton {
					text: "Save"
					font.family: "Poppins"
					onClicked: discovery.setPort(lotusPort.text)
				}
			}
		}
	}
}
