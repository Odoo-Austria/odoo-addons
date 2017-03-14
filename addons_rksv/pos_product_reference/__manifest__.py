# -*- coding: utf-8 -*-
{
"name" : "POS Product Reference",
"version" : "10.0.0",
"author" : "Callino",
"website" : "http://callino.at",
"category" : "Point of Sale",
"depends" : ["base", 'point_of_sale'],
"summary": """
    Druckt einen Referenz Text zum Produkt.
""",
'description': """
POS Product Reference
=============================

    *  31.01.2017: Erstellt - GB
    *  25.02.2017: Portiert auf Odoo v10 - WP

""",
"data" : [
        'views/templates.xml',
        'views/pos_order_line.xml',
        'views/product_template.xml',
],
 'qweb': [
        'static/src/xml/pos_product_ref.xml',
],
"demo": [],
"installable": True,
"auto_install": False,
}