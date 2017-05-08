# -*- coding: utf-8 -*-
{
    'name': 'POS receipt options',
    'version': '8.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Add more receipt printing options',
    'website': 'https://www.callino.at/',
    'description': """
POS Receipt Printing
====================
* Option for "Print Stock Name"
* Option for "Print Logo"
* Option for "Print Address"
* Option for "Print Phone"
* Option for "Print VAT"
* Option for "Print EMail"
* Option for "Print Website"
* Option for "Print Cashier"

""",
    'author': 'Wolfgang Pichler (Callino)',
    'depends': ['point_of_sale', 'pos_compat'],
    'test': [
    ],
    'data': [
        'views/templates.xml',
        'views/pos_config.xml',
    ],
    'qweb': [
        'static/src/xml/receipt.xml'
    ],
    'installable': True,
    'auto_install': False,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
